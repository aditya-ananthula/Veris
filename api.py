from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
from uuid import UUID
import logging
import rag_core
import config
import intel_compare

logging.basicConfig(level=getattr(logging, config.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("veris")

MAX_UPLOAD_BYTES = config.MAX_UPLOAD_BYTES
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}

app = FastAPI(title=config.APP_NAME)

origins = config.ALLOWED_ORIGINS or [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    session_id: str


class AskResponse(BaseModel):
    answer: str
    sources: list[str]
    validation: str


class DocumentsResponse(BaseModel):
    documents: list[str]


class AbsorbResponse(BaseModel):
    filename: str
    chunks_added: int


class HealthResponse(BaseModel):
    status: str
    app: str
    groq_configured: bool
    model: str


class CapabilitiesResponse(BaseModel):
    supported_extensions: list[str]
    max_upload_bytes: int
    max_upload_mb: float
    llm_model: str
    groq_configured: bool
    session_ttl_seconds: int
    persistence: str
    features: list[str]


class DocumentMeta(BaseModel):
    filename: str
    chunks: int
    extension: str
    size_chars: int


class IntelCompareResponse(BaseModel):
    matching: bool
    conflict: bool
    category: str
    explanation: str
    preserved: dict


class IntelContradictResponse(BaseModel):
    conflicts: list[dict]


class IntelContradictStatsResponse(BaseModel):
    session_id: str
    # stats endpoint shape
    total: int = 0
    open: int = 0
    resolved: int = 0
    dismissed: int = 0
    by_category: dict = {}
    # scan endpoint shape
    total_compared: int = 0
    conflicts: int = 0
    matches: int = 0
    uncertain: int = 0
    entity_mismatches: int = 0
    period_differences: int = 0
    records: list = []


class IntelContradictMeta(BaseModel):
    conflict_id: str
    status: str
    updated_at: float


class IntelContradictDetailResponse(BaseModel):
    conflict_id: str
    session_id: str
    category: str
    subject: str
    attribute: str
    value_a: str
    value_b: str
    doc_a: str
    doc_b: str
    fact_a_id: str
    fact_b_id: str
    matching: bool
    conflict: bool
    explanation: str
    status: str
    evidence_a: str
    evidence_b: str


def _profile_id(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid browser profile")


@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "app": config.APP_NAME,
        "groq_configured": config.has_groq_key(),
        "model": config.GROQ_MODEL,
    }


@app.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities():
    return {
        "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "max_upload_mb": round(MAX_UPLOAD_BYTES / (1024 * 1024), 1),
        "llm_model": config.GROQ_MODEL,
        "groq_configured": config.has_groq_key(),
        "session_ttl_seconds": config.SESSION_TTL_SECONDS,
        "persistence": "ephemeral-in-memory",
        "features": [
            "upload",
            "list-documents",
            "ask-grounded-qa",
            "validation",
            "replace-on-reupload",
            "delete-document",
        ],
    }

@app.post("/ask", response_model=AskResponse)
def ask(payload: Question):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty")
    try:
        return rag_core.ask_question(payload.question, _profile_id(payload.session_id))
    except RuntimeError as e:
        # Missing Groq key / provider misconfiguration -> 502, no secret leakage.
        raise HTTPException(status_code=502, detail=str(e))

@app.get("/documents", response_model=DocumentsResponse)
def documents(session_id: str):
    return {"documents": rag_core.list_documents(_profile_id(session_id))}


@app.get("/documents/meta", response_model=list[DocumentMeta])
def documents_meta(session_id: str):
    profile_id = _profile_id(session_id)
    return rag_core.get_documents_meta(profile_id)


@app.delete("/documents/{filename}")
def delete_document(filename: str, session_id: str):
    profile_id = _profile_id(session_id)
    safe_name = os.path.basename(filename.replace("\\", "/"))
    if not safe_name:
        raise HTTPException(status_code=400, detail="A filename is required")
    removed = rag_core.delete_document(profile_id, safe_name)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Document not found in this session")
    return {"filename": safe_name, "chunks_removed": removed}


# ---- Phase 3: structured intelligence (SQLite sidecar; session-scoped) ----

class IntelDocument(BaseModel):
    doc_id: str
    filename: str
    extension: str
    version: int
    status: str
    extraction_status: str
    extraction_error: str | None = None
    chunks: int


class IntelFact(BaseModel):
    fact_id: str
    doc_id: str
    filename: str
    subject: str
    attribute: str
    value: str
    value_type: str
    unit: str | None = None
    period: str | None = None
    entity_id: str | None = None
    evidence: str
    char_start: int | None = None
    char_end: int | None = None
    status: str
    validation_notes: str = ""


class IntelEntity(BaseModel):
    entity_id: str
    canonical_name: str
    entity_type: str
    aliases: list[str]
    status: str
    fact_count: int = 0


class IntelRelationship(BaseModel):
    rel_id: str
    src_entity_id: str
    rel_type: str
    dst_entity_id: str
    doc_id: str
    evidence: str
    status: str


def _phase4():
    import intel_contradict
    intel_contradict.init_db()
    return intel_contradict


def _intel() -> object:
    import intel_store
    intel_store.init_db()
    return intel_store


@app.get("/intel/contradictions", response_model=IntelContradictResponse)
def intel_contradictions(session_id: str,
                         entity_id: str | None = None,
                         category: str | None = None,
                         status: str | None = None,
                         doc_id: str | None = None):
    contr = _phase4()
    records = contr.list_contradictions(_profile_id(session_id), status=status)
    # Client-side filtering for entity_id / category / doc_id
    filtered = []
    for r in records:
        if entity_id and r.get("fact_a_id") != entity_id and r.get("fact_b_id") != entity_id:
            continue
        if category and r.get("category") != category:
            continue
        if doc_id and r.get("doc_a") != doc_id and r.get("doc_b") != doc_id:
            continue
        filtered.append(r)
    return {"conflicts": filtered}


@app.get("/intel/contradictions/stats", response_model=IntelContradictStatsResponse)
def intel_contradictions_stats(session_id: str):
    contr = _phase4()
    return contr.get_contradiction_stats(_profile_id(session_id))


@app.post("/intel/contradictions/scan", response_model=IntelContradictStatsResponse)
def intel_contradictions_scan(session_id: str):
    contr = _phase4()
    return contr.scan_contradictions(_profile_id(session_id), use_llm=False)


@app.post("/intel/contradictions/refresh", response_model=IntelContradictStatsResponse)
def intel_contradictions_refresh(session_id: str):
    contr = _phase4()
    return contr.scan_contradictions(_profile_id(session_id), use_llm=False)


@app.patch("/intel/contradictions/{conflict_id}", response_model=IntelContradictMeta)
def intel_contradictions_update(conflict_id: str, session_id: str,
                                payload: dict):
    contr = _phase4()
    result = contr.update_contradiction(conflict_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Contradiction not found")
    return {"conflict_id": result["conflict_id"], "status": result["status"],
            "updated_at": result["updated_at"]}


@app.get("/intel/contradictions/{conflict_id}", response_model=IntelContradictDetailResponse)
def intel_contradictions_detail(conflict_id: str, session_id: str):
    contr = _phase4()
    detail = contr.get_contradiction(conflict_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Contradiction not found")
    return detail


@app.post("/intel/compare", response_model=IntelCompareResponse)
def intel_compare_endpoint(payload: dict):
    try:
        claim_a = payload.get("claim_a", {})
        claim_b = payload.get("claim_b", {})
        result = intel_compare.compare(
            claim_a, claim_b,
            source_doc_id_a=payload.get("source_doc_id_a", ""),
            source_doc_id_b=payload.get("source_doc_id_b", ""),
            use_llm=payload.get("use_llm", False),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "matching": result.matching,
        "conflict": result.conflict,
        "category": result.category,
        "explanation": result.explanation,
        "preserved": result.preserved,
    }

@app.get("/intel/documents", response_model=list[IntelDocument])
def intel_documents(session_id: str):
    store = _intel()
    return [
        {k: d.get(k) for k in
         ("doc_id", "filename", "extension", "version", "status",
          "extraction_status", "extraction_error", "chunks")}
        for d in store.list_documents(_profile_id(session_id))
    ]


@app.get("/intel/facts", response_model=list[IntelFact])
def intel_facts(session_id: str, query: str = "", entity_id: str | None = None,
                doc_id: str | None = None, limit: int = 50):
    store = _intel()
    return store.search_facts(_profile_id(session_id), query=query,
                              entity_id=entity_id, doc_id=doc_id, limit=limit)


@app.get("/intel/entities", response_model=list[IntelEntity])
def intel_entities(session_id: str):
    store = _intel()
    return store.list_entities(_profile_id(session_id))


@app.get("/intel/relationships", response_model=list[IntelRelationship])
def intel_relationships(session_id: str):
    store = _intel()
    return store.list_relationships(_profile_id(session_id))


@app.post("/intel/retry/{doc_id}")
def intel_retry(doc_id: str, session_id: str):
    """Re-run extraction for a document using its stored source text.
    Source text is re-derived from the live Chroma chunks (never stored raw)."""
    import intel_extract
    store = _intel()
    profile_id = _profile_id(session_id)
    doc = store.get_document(doc_id)
    if not doc or doc.get("session_id") != profile_id:
        raise HTTPException(status_code=404, detail="Document not found in this session")
    collection = rag_core._get_collection(profile_id)
    stored = collection.get(include=["documents", "metadatas"])
    parts = [t for t, m in zip(stored["documents"], stored["metadatas"])
             if (m or {}).get("source") == doc["filename"] and not (t or "").startswith("Document filename: ")]
    if not parts:
        raise HTTPException(status_code=409, detail="No indexed text remains for this document")
    store.set_extraction_state(doc_id, "extracting", None)
    try:
        summary = intel_extract.run_extraction(profile_id, doc_id, doc["filename"], "\n".join(parts))
    except Exception as exc:
        store.set_extraction_state(doc_id, "failed", f"extraction-error: {exc}"[:500])
        raise HTTPException(status_code=502, detail="Extraction failed; document remains indexed")
    if summary.get("status") == "failed":
        raise HTTPException(status_code=502, detail=summary.get("error", "LLM unavailable; document remains indexed"))
    return summary

@app.post("/absorb")
def absorb(file: UploadFile, session_id: str = Form(...)):
    profile_id = _profile_id(session_id)
    filename = os.path.basename((file.filename or "").replace("\\", "/"))
    extension = os.path.splitext(filename)[1].lower()
    if extension not in {".pdf", ".docx", ".txt", ".md"}:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    if not filename:
        raise HTTPException(status_code=400, detail="A filename is required")

    file_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Documents must be 10 MB or smaller")
    num_chunks = rag_core.ingest_document_bytes(file_bytes, profile_id, doc_id_prefix=filename)
    return {"filename": filename, "chunks_added": num_chunks}


class ChunkMeta(BaseModel):
    id: str
    text: str
    docId: str
    docFilename: str
    chunkIndex: int
    embedding: list[float] | None


class ChunkCloudResponse(BaseModel):
    chunks: list[ChunkMeta]
    total: int


@app.get("/intel/chunks", response_model=ChunkCloudResponse)
def intel_chunks(session_id: str, doc_id: str | None = None):
    """Return all chunks with embeddings for a session, used by the Chunk Cloud."""
    profile_id = _profile_id(session_id)
    collection = rag_core._get_collection(profile_id)
    count = collection.count()
    if count == 0:
        return {"chunks": [], "total": 0}
    stored = collection.get(include=["embeddings", "documents", "metadatas"])
    chunks = []
    raw_emb = stored.get("embeddings")
    embeddings = raw_emb.tolist() if hasattr(raw_emb, "tolist") else (list(raw_emb) if raw_emb else [])
    documents = stored.get("documents") or []
    metadatas = stored.get("metadatas") or []
    ids = stored.get("ids") or []
    for i, (cid, text, meta) in enumerate(zip(ids, documents, metadatas)):
        emb = embeddings[i] if i < len(embeddings) else None
        if emb is not None and hasattr(emb, "tolist"):
            emb = emb.tolist()
        elif emb is not None:
            emb = list(emb)
        meta = meta or {}
        doc_key = str(meta.get("document_key", meta.get("source", "")))
        source_name = str(meta.get("source", ""))
        if doc_id and doc_id not in (doc_key, source_name):
            continue
        chunks.append({
            "id": cid,
            "text": text or "",
            "docId": doc_key,
            "docFilename": source_name,
            "chunkIndex": i,
            "embedding": emb,
        })
    return {"chunks": chunks, "total": len(chunks)}

# ---- Knowledge graph: stats, document graph, entity detail ----

class IntelStatsResponse(BaseModel):
    documents: int
    chunks: int
    entities: int
    facts: int
    relationships: int


class DocumentGraphEdge(BaseModel):
    source: str
    target: str
    weight: int
    similarity: float = 0.5
    rel_type: str
    evidence: str


class IntelDocumentGraphItem(IntelDocument):
    key_topics: list[str] = []


class IntelDocumentGraphResponse(BaseModel):
    documents: list[IntelDocumentGraphItem]
    edges: list[DocumentGraphEdge]


class EntityFact(BaseModel):
    fact_id: str
    doc_id: str
    filename: str
    subject: str
    attribute: str
    value: str
    value_type: str
    unit: str | None = None
    period: str | None = None
    evidence: str
    status: str


class EntityRelated(BaseModel):
    entity_id: str
    canonical_name: str
    entity_type: str
    aliases: list[str]
    status: str


class IntelEntityDetailResponse(BaseModel):
    entity_id: str
    canonical_name: str
    entity_type: str
    aliases: list[str]
    status: str
    fact_count: int
    facts: list[EntityFact]
    related_entities: list[EntityRelated]
    related_count: int


@app.get("/intel/stats", response_model=IntelStatsResponse)
def intel_stats(session_id: str):
    store = _intel()
    return store.get_stats(_profile_id(session_id))


@app.get("/intel/document-graph", response_model=IntelDocumentGraphResponse)
def intel_document_graph(session_id: str):
    store = _intel()
    result = store.get_document_graph(_profile_id(session_id))
    return result


@app.get("/intel/entity/{entity_id}", response_model=IntelEntityDetailResponse)
def intel_entity_detail(entity_id: str, session_id: str):
    store = _intel()
    detail = store.get_entity_detail(_profile_id(session_id), entity_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Entity not found in this session")
    return detail


class CompareDocsRequest(BaseModel):
    session_id: str
    doc_a: str
    doc_b: str


class CompareDocsResponse(BaseModel):
    doc_a: str
    doc_b: str
    matches: list[dict]
    conflicts: list[dict]
    unique_a: list[dict]
    unique_b: list[dict]
    summary: str


@app.post("/intel/compare-documents", response_model=CompareDocsResponse)
def intel_compare_documents(payload: CompareDocsRequest):
    store = _intel()
    profile_id = _profile_id(payload.session_id)
    facts_a = store.search_facts(profile_id, doc_id=payload.doc_a, limit=100)
    facts_b = store.search_facts(profile_id, doc_id=payload.doc_b, limit=100)
    # Also attempt match by filename if doc_id was passed as filename
    if not facts_a:
        all_facts = store.search_facts(profile_id, limit=200)
        facts_a = [f for f in all_facts if f.get("filename") == payload.doc_a]
    if not facts_b:
        all_facts = store.search_facts(profile_id, limit=200)
        facts_b = [f for f in all_facts if f.get("filename") == payload.doc_b]

    matches = []
    conflicts = []
    used_b = set()

    for fa in facts_a:
        matched = False
        for fb in facts_b:
            if fb["fact_id"] in used_b:
                continue
            # Compare claims with same subject or attribute
            same_subj = fa.get("subject", "").lower() == fb.get("subject", "").lower()
            same_attr = fa.get("attribute", "").lower() == fb.get("attribute", "").lower()
            if same_subj or same_attr:
                res = intel_compare.compare(fa, fb, source_doc_id_a=payload.doc_a, source_doc_id_b=payload.doc_b)
                if res.matching:
                    matches.append({"claim_a": fa, "claim_b": fb, "explanation": res.explanation})
                    used_b.add(fb["fact_id"])
                    matched = True
                    break
                elif res.conflict:
                    conflicts.append({"claim_a": fa, "claim_b": fb, "explanation": res.explanation})
                    used_b.add(fb["fact_id"])
                    matched = True
                    break
        if not matched:
            pass

    unique_a = [f for f in facts_a if not any(m["claim_a"]["fact_id"] == f["fact_id"] for m in matches + conflicts)]
    unique_b = [f for f in facts_b if f["fact_id"] not in used_b]

    summary = f"Compared {len(facts_a)} claims from {payload.doc_a} and {len(facts_b)} claims from {payload.doc_b}. Found {len(matches)} agreements and {len(conflicts)} conflicting statements."
    return {
        "doc_a": payload.doc_a,
        "doc_b": payload.doc_b,
        "matches": matches,
        "conflicts": conflicts,
        "unique_a": unique_a,
        "unique_b": unique_b,
        "summary": summary,
    }
