import os
import re
import hashlib
import io
import time
import zipfile
import xml.etree.ElementTree as ET
from pypdf import PdfReader
import chromadb
from dotenv import load_dotenv
from groq import Groq
from streamlit.errors import StreamlitSecretNotFoundError

load_dotenv()

import config as _veris_config

DISTANCE_THRESHOLD = _veris_config.DISTANCE_THRESHOLD
GROQ_MODEL = _veris_config.GROQ_MODEL
groq_client = None
groq_client_key = None

_chroma_client = None
_chroma_persist_dir = None


def get_chroma_client():
    """Ephemeral by default (Phase 1-2 behavior). Opt-in persistent via
    VERIS_CHROMA_DIR. Never deletes existing data; legacy chroma_db/ untouched."""
    global _chroma_client, _chroma_persist_dir
    want = (_veris_config.CHROMA_PERSIST_DIR or "").strip()
    if _chroma_client is None or _chroma_persist_dir != want:
        if want:
            os.makedirs(want, exist_ok=True)
            _chroma_client = chromadb.PersistentClient(path=want)
        else:
            _chroma_client = chromadb.EphemeralClient()
        _chroma_persist_dir = want
    return _chroma_client


client = chromadb.EphemeralClient()
SESSION_TTL_SECONDS = _veris_config.SESSION_TTL_SECONDS

STOP_WORDS = {"a", "am", "are", "do", "does", "i", "is", "know", "me", "my", "the", "what", "which", "with", "you"}

def _get_collection(session_id):
    """Return this session's collection and expire inactive sessions.
    Uses the configured Chroma client (ephemeral default, persistent opt-in)."""
    backend = get_chroma_client()
    now = time.time()
    for collection in backend.list_collections():
        if not collection.name.startswith("session_"):
            continue
        last_accessed = (collection.metadata or {}).get("last_accessed", now)
        if now - float(last_accessed) > SESSION_TTL_SECONDS:
            backend.delete_collection(name=collection.name)

    collection = backend.get_or_create_collection(
        name=f"session_{session_id}",
        metadata={"last_accessed": now},
    )
    collection.modify(metadata={"last_accessed": now})
    return collection

def _get_groq_client():
    global groq_client, groq_client_key

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        try:
            import streamlit as st

            api_key = st.secrets.get("GROQ_API_KEY")
        except StreamlitSecretNotFoundError:
            api_key = None

    if not api_key:
        raise RuntimeError(
            "The hosted LLM is not configured. Add GROQ_API_KEY to the app's secrets."
        )

    if groq_client is None or groq_client_key != api_key:
        groq_client = Groq(api_key=api_key)
        groq_client_key = api_key
    return groq_client

def _chat(messages):
    """Chat completion with safe failure handling.

    Provider failures (missing key, network errors, timeouts, HTTP errors,
    malformed or empty responses) are raised as RuntimeError so callers --
    notably the /ask route and Streamlit app -- can convert them into a safe
    error instead of a raw 500 stack trace. No secrets surface in error
    messages, and the failure is never silently converted into an answer.
    """
    try:
        client = _get_groq_client()
        response = client.chat.completions.create(model=GROQ_MODEL, messages=messages)
        content = response.choices[0].message.content
        if content is None:
            raise RuntimeError("language model returned an empty response")
        return content
    except RuntimeError:
        raise
    except Exception as exc:  # provider errors, timeouts, malformed responses
        raise RuntimeError(
            f"language model request failed: {type(exc).__name__}"
        ) from exc

def _extract_document_text(file_bytes, extension):
    extension = extension.lower()
    if extension == ".pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    elif extension == ".docx":
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as document:
            root = ET.fromstring(document.read("word/document.xml"))
        full_text = " ".join(
            element.text or "" for element in root.iter()
            if element.tag.endswith("}t")
        )
    elif extension in {".txt", ".md"}:
        full_text = file_bytes.decode("utf-8-sig", errors="replace")
    else:
        raise ValueError(f"Unsupported document type: {extension}")
    return re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', full_text)

def ingest_document_bytes(file_bytes, session_id, doc_id_prefix="doc"):
    collection = _get_collection(session_id)
    extension = os.path.splitext(doc_id_prefix)[1].lower()
    full_text = _extract_document_text(file_bytes, extension)

    chunks = _chunk_text(full_text)

    # Add the filename as a searchable chunk so questions about the document's
    # identity (e.g. "what week is this") can be answered using filename context,
    # not just the body text.
    filename_chunk = f"Document filename: {doc_id_prefix}"
    chunks = [filename_chunk] + chunks

    stored = collection.get(include=["documents", "metadatas"])
    old_ids = []
    for stored_id, stored_text, metadata in zip(
        stored["ids"], stored["documents"], stored["metadatas"]
    ):
        source = metadata.get("source") if metadata else None
        if source == doc_id_prefix or (
            source is None
            and stored_text == f"Document filename: {doc_id_prefix}"
        ):
            old_ids.append(stored_id)

    if old_ids:
        collection.delete(ids=old_ids)

    document_key = hashlib.sha256(doc_id_prefix.encode("utf-8")).hexdigest()[:20]
    collection.add(
        documents=chunks,
        ids=[f"{document_key}_{i}" for i in range(len(chunks))],
        metadatas=[{"source": doc_id_prefix} for _ in chunks],
    )
    # Phase 3 registry: never breaks RAG — failures are logged, doc stays indexed.
    try:
        import intel_store
        import intel_extract
        content_hash = hashlib.sha256(file_bytes).hexdigest()
        doc_id = intel_store.upsert_document(
            session_id, doc_id_prefix, extension, content_hash, len(chunks),
            status="indexed", extraction_status="extracting",
        )
        # Change detection: supersede prior versions of this filename so
        # re-ingestion with changed content never leaves stale facts or
        # vector records behind. Idempotent for identical re-uploads.
        try:
            intel_store.supersede_older_versions(session_id, doc_id_prefix, doc_id)
        except Exception as exc:  # registry issues must not break ingestion
            import logging
            logging.getLogger("veris").warning(
                "supersede older versions failed for %s: %s", doc_id_prefix, exc
            )
        if _veris_config.EXTRACTION_ENABLED:
            try:
                intel_extract.run_extraction(session_id, doc_id, doc_id_prefix, full_text)
            except Exception as exc:  # extraction must not break ingestion
                intel_store.set_extraction_state(doc_id, "failed", f"extraction-error: {exc}"[:500])
        else:
            intel_store.set_extraction_state(doc_id, "skipped", "extraction disabled (VERIS_EXTRACTION_ENABLED=off)")
    except Exception as exc:
        import logging
        logging.getLogger("veris").warning("intel registry update failed for %s: %s", doc_id_prefix, exc)
    return len(chunks)

def ingest_document(filepath, session_id, doc_id_prefix="doc"):
    with open(filepath, "rb") as document:
        file_bytes = document.read()
    return ingest_document_bytes(file_bytes, session_id, doc_id_prefix)

def ingest_pdf(filepath, session_id, doc_id_prefix="doc"):
    return ingest_document(filepath, session_id, doc_id_prefix)

def list_documents(session_id):
    collection = _get_collection(session_id)
    stored = collection.get(include=["documents", "metadatas"])
    filenames = set()
    for document, metadata in zip(stored["documents"], stored["metadatas"]):
        source = metadata.get("source") if metadata else None
        if source:
            filenames.add(source)
        elif document.startswith("Document filename: "):
            filenames.add(document.removeprefix("Document filename: "))
    return sorted(filenames, key=str.casefold)


def get_documents_meta(session_id):
    """Per-document chunk counts + char sizes, derived from live collection state."""
    collection = _get_collection(session_id)
    stored = collection.get(include=["documents", "metadatas"])
    stats = {}
    for document, metadata in zip(stored["documents"], stored["metadatas"]):
        source = (metadata or {}).get("source")
        if not source:
            continue
        entry = stats.setdefault(source, {"chunks": 0, "size_chars": 0})
        entry["chunks"] += 1
        entry["size_chars"] += len(document or "")
    result = [
        {
            "filename": name,
            "chunks": entry["chunks"],
            "extension": os.path.splitext(name)[1].lower(),
            "size_chars": entry["size_chars"],
        }
        for name, entry in stats.items()
    ]
    return sorted(result, key=lambda item: item["filename"].casefold())


def delete_document(session_id, filename):
    """Remove all chunks for one filename in this session. Returns chunks removed."""
    collection = _get_collection(session_id)
    stored = collection.get(include=["documents", "metadatas"])
    ids = [
        stored_id
        for stored_id, metadata in zip(stored["ids"], stored["metadatas"])
        if (metadata or {}).get("source") == filename
    ]
    if ids:
        collection.delete(ids=ids)
    try:
        import intel_store
        intel_store.delete_session_document(session_id, filename)
    except Exception as exc:
        import logging
        logging.getLogger("veris").warning("intel registry delete failed for %s: %s", filename, exc)
    return len(ids)

def _chunk_text(text, chunk_size=500, overlap=50):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        chunk_words = []
        char_count = 0
        i = start
        while i < len(words) and char_count < chunk_size:
            chunk_words.append(words[i])
            char_count += len(words[i]) + 1
            i += 1
        chunks.append(" ".join(chunk_words))
        overlap_chars = 0
        back = i
        while back > start and overlap_chars < overlap:
            back -= 1
            overlap_chars += len(words[back]) + 1
        start = back if back > start else i
    return chunks

def _validate_answer(answer, context):
    validation_prompt = f"""You are a strict fact-checker. Check whether the ANSWER is fully supported by the CONTEXT.

CONTEXT:
{context}

ANSWER TO CHECK:
{answer}

Instructions:
- Check every claim in the ANSWER against the CONTEXT only.
- A claim is UNSUPPORTED if it's not directly stated or clearly implied by the CONTEXT.
- Respond in EXACTLY this format, nothing else:

VERDICT: [SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED]
UNSUPPORTED_CLAIMS: [list specific unsupported claims, or "None"]
REASONING: [one sentence]"""
    return _chat([{"role": "user", "content": validation_prompt}])

def _is_supported(validation):
    verdict = re.search(r"^\s*VERDICT:\s*(\w+)", validation, re.IGNORECASE | re.MULTILINE)
    return verdict is not None and verdict.group(1).upper() == "SUPPORTED"

def _revise_answer(question, answer, context, validation):
    revision_prompt = f"""Rewrite the ANSWER to address the QUESTION using only facts explicitly present in the CONTEXT.
Remove every claim identified as unsupported. Do not add general knowledge, implications, or advice.
If the context does not contain enough information, say that you don't know based on the provided documents.
Return only the revised answer.

CONTEXT:
{context}

QUESTION:
{question}

ANSWER TO REVISE:
{answer}

VALIDATION FEEDBACK:
{validation}"""
    return _chat([{"role": "user", "content": revision_prompt}])

def ask_question(question, session_id):
    collection = _get_collection(session_id)

    if collection.count() == 0:
        return {"answer": "No documents have been uploaded yet. Upload a document to get started.", "sources": [], "validation": "N/A"}

    results = collection.query(
        query_texts=[question],
        n_results=collection.count(),
        include=["documents", "distances"]
    )
    retrieved_chunks = results["documents"][0]
    distances = results["distances"][0]

    question_terms = {
        term for term in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", question.lower())
        if term not in STOP_WORDS
    }

    filtered = [
        (chunk, dist) for chunk, dist in zip(retrieved_chunks, distances)
        if dist <= DISTANCE_THRESHOLD
        or any(re.search(rf"(?<![a-z]){re.escape(term)}(?![a-z])", chunk.lower()) for term in question_terms)
    ]

    if not filtered:
        return {
            "answer": "I don't have relevant information in your documents to answer this.",
            "sources": [],
            "validation": "N/A (no context retrieved)"
        }

    context = "\n\n".join([c for c, d in filtered])

    prompt = f"""Answer the question using ONLY the context below. If the answer isn't in the context, say "I don't know based on the provided documents."

Context:
{context}

Question: {question}

Answer:"""

    answer_text = _chat([{"role": "user", "content": prompt}])

    if "don't know" in answer_text.lower() or "cannot" in answer_text.lower() or "no relevant" in answer_text.lower():
        validation = "SUPPORTED (model correctly declined to answer)"
    else:
        validation = _validate_answer(answer_text, context)
        if not _is_supported(validation):
            answer_text = _revise_answer(question, answer_text, context, validation)
            if "don't know" in answer_text.lower() or "cannot" in answer_text.lower() or "no relevant" in answer_text.lower():
                validation = "SUPPORTED (model correctly declined to answer)"
            else:
                validation = _validate_answer(answer_text, context)
                if not _is_supported(validation):
                    answer_text = "I couldn't produce an answer fully supported by your documents. Try rephrasing the question or uploading relevant material."
                    validation = (
                        "VERDICT: UNSUPPORTED\n"
                        "UNSUPPORTED_CLAIMS: The revised answer did not pass verification.\n"
                        "REASONING: The answer was withheld to avoid presenting unsupported information."
                    )

    return {
        "answer": answer_text,
        "sources": [c[:150] for c, d in filtered],
        "validation": validation
    }