"""Phase 3 tests: structured extraction, persistence, provenance, resolution."""
import json
import uuid

import intel_extract
import intel_store
import rag_core
from fastapi.testclient import TestClient
import api


def _sid():
    return str(uuid.uuid4())


def _tmpdb(monkeypatch, tmp_path):
    path = str(tmp_path / "veris_test.db")
    monkeypatch.setattr("config.SQLITE_PATH", path)
    intel_store.init_db(path)
    return path


def _llm_ok(doc_text):
    return json.dumps({
        "entities": [{"name": "Acme Corp", "entity_type": "org", "alias_of": ""}],
        "facts": [{
            "subject": "Acme Corp", "attribute": "revenue", "value": "$5M",
            "value_type": "money", "unit": "USD", "period": "Q1 2026",
            "evidence": "Acme Corp revenue was $5M.",
            "confidence": 0.9,
        }],
        "relationships": [],
    }), None


def test_parse_valid_malformed_and_salvage():
    raw = json.dumps({"entities": [{"name": "X", "entity_type": "org", "alias_of": ""}],
                      "facts": [], "relationships": []})
    res, notes = intel_extract.parse_extraction_output(raw)
    assert len(res.entities) == 1 and notes == []
    res2, notes2 = intel_extract.parse_extraction_output("not json {{{")
    assert res2.facts == [] and any("malformed" in n for n in notes2)
    mixed = json.dumps({"entities": [{"name": "", "entity_type": "org"}],
                        "facts": [{"subject": "S", "attribute": "a", "value": "v", "evidence": "e"}],
                        "relationships": "oops"})
    res3, notes3 = intel_extract.parse_extraction_output(mixed)
    assert len(res3.facts) == 1


def test_empty_document_no_facts(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    doc_id = intel_store.upsert_document(sid, "e.txt", ".txt", "h", 1, path=path)
    out = intel_extract.run_extraction(sid, doc_id, "e.txt", "   ", llm_caller=_llm_ok, path=path)
    assert out["status"] == "complete-empty"
    assert intel_store.search_facts(sid, path=path) == []


def test_extraction_failure_keeps_index(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    doc_id = intel_store.upsert_document(sid, "f.txt", ".txt", "h", 1, path=path)

    def boom(_text):
        return None, RuntimeError("provider down")

    out = intel_extract.run_extraction(sid, doc_id, "f.txt", "Some text.", llm_caller=boom, path=path)
    assert out["status"] == "failed"
    doc = intel_store.get_document(doc_id, path=path)
    assert doc["extraction_status"] == "failed" and "provider down" in (doc["extraction_error"] or "")


def test_fact_persistence_and_provenance(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    text = "Acme Corp revenue was $5M."
    doc_id = intel_store.upsert_document(sid, "a.txt", ".txt", "h1", 2, path=path)
    out = intel_extract.run_extraction(sid, doc_id, "a.txt", text, llm_caller=_llm_ok, path=path)
    assert out["status"] == "complete" and out["facts"] == 1
    facts = intel_store.search_facts(sid, path=path)
    assert len(facts) == 1
    f = facts[0]
    assert f["doc_id"] == doc_id and f["evidence"] == text
    assert f["char_start"] == 0 and f["char_end"] == len(text)
    assert f["status"] == "validated" and f["entity_id"]


def test_uncertain_when_evidence_not_verbatim(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    doc_id = intel_store.upsert_document(sid, "u.txt", ".txt", "h", 1, path=path)

    def fake(_t):
        return json.dumps({"entities": [], "facts": [{
            "subject": "S", "attribute": "a", "value": "v", "evidence": "nowhere in source",
            "confidence": 0.9}]}), None

    intel_extract.run_extraction(sid, doc_id, "u.txt", "Different source.", llm_caller=fake, path=path)
    facts = intel_store.search_facts(sid, path=path)
    assert facts[0]["status"] == "uncertain" and "verbatim" in facts[0]["validation_notes"]


def test_entity_resolution_conservative(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    a = intel_store.upsert_entity(sid, "Acme Corp", "org", path=path)
    b = intel_store.upsert_entity(sid, "  acme   corp ", "org", alias="ACME", path=path)
    assert a == b
    c = intel_store.upsert_entity(sid, "Acme Corp", "person", path=path)
    assert c != a
    d = intel_store.upsert_entity(sid, "Acme Corporation", "org", path=path)
    assert d != a
    ents = intel_store.list_entities(sid, path=path)
    assert any("ACME" in e["aliases"] for e in ents)


def test_db_reopen_persists(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    doc_id = intel_store.upsert_document(sid, "p.txt", ".txt", "h", 1, path=path)
    intel_extract.run_extraction(sid, doc_id, "p.txt", "Acme Corp revenue was $5M.",
                                 llm_caller=_llm_ok, path=path)
    assert intel_store.get_document(doc_id, path=path)["filename"] == "p.txt"
    assert len(intel_store.search_facts(sid, path=path)) == 1
    assert len(intel_store.list_entities(sid, path=path)) == 1


def test_ingest_registers_doc_with_extraction_off(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.SQLITE_PATH", path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", False)
    sid = _sid()
    n = rag_core.ingest_document_bytes(b"hello world " * 30, sid, "r.txt")
    assert n >= 1
    docs = intel_store.list_documents(sid, path=path)
    assert len(docs) == 1 and docs[0]["extraction_status"] == "skipped"


def test_intel_api_endpoints(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient
    import api

    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.SQLITE_PATH", path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", False)
    monkeypatch.setattr(
        rag_core, "_chat",
        lambda messages: "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: ok.",
    )
    c = TestClient(api.app)
    sid = str(uuid.uuid4())
    r = c.post("/absorb", files={"file": ("k.txt", b"Acme Corp revenue was $5M. " * 20)}, data={"session_id": sid})
    assert r.status_code == 200
    docs = c.get("/intel/documents", params={"session_id": sid})
    assert docs.status_code == 200 and len(docs.json()) == 1
    assert docs.json()[0]["extraction_status"] == "skipped"
    assert set(docs.json()[0]) == {"doc_id", "filename", "extension", "version",
                                   "status", "extraction_status", "extraction_error", "chunks"}
    facts = c.get("/intel/facts", params={"session_id": sid})
    assert facts.status_code == 200 and facts.json() == []
    ents = c.get("/intel/entities", params={"session_id": sid})
    assert ents.status_code == 200 and ents.json() == []
    rels = c.get("/intel/relationships", params={"session_id": sid})
    assert rels.status_code == 200 and rels.json() == []
    bad = c.get("/intel/facts", params={"session_id": "not-a-uuid"})
    assert bad.status_code == 400
    # no secret leakage in intel responses
    assert "GROQ_API_KEY" not in c.get("/capabilities").text
    assert "GROQ_API_KEY" not in facts.text


def _absorb(c, sid, filename, text):
    return c.post(
        "/absorb",
        files={"file": (filename, text.encode("utf-8"))},
        data={"session_id": sid},
    )


def test_ask_provider_failure_returns_502_not_500(monkeypatch, tmp_path):
    """Regression: an LLM provider failure during a retrieval-backed question
    must surface as a safe HTTP error (502), never a raw 500 stack trace."""
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.SQLITE_PATH", path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", False)
    sid = str(uuid.uuid4())
    assert _absorb(c := TestClient(api.app), sid, "skills.txt",
                   "John Doe has Python, TypeScript, and Rust skills.").status_code == 200

    def boom_client():
        raise ValueError("upstream provider exploded")  # not RuntimeError

    monkeypatch.setattr(rag_core, "_get_groq_client", boom_client)
    r = c.post("/ask", json={"question": "what skills do i have", "session_id": sid})
    assert r.status_code == 502, r.text
    body = r.json()
    assert "GROQ_API_KEY" not in r.text
    assert "stack" not in r.text.lower() and "traceback" not in r.text.lower()


def test_ask_grounded_answer_with_evidence(monkeypatch, tmp_path):
    """A question answerable from an uploaded document returns the answer with
    cited sources and a supported validation verdict."""
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.SQLITE_PATH", path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", False)
    sid = str(uuid.uuid4())
    c = TestClient(api.app)
    assert _absorb(c, sid, "resume.txt",
                   "John Doe has Python, TypeScript, and Rust skills.").status_code == 200

    script = iter([
        "John Doe has Python, TypeScript, and Rust skills.",
        "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: grounded in context.",
    ])
    monkeypatch.setattr(rag_core, "_chat", lambda messages: next(script))
    r = c.post("/ask", json={"question": "what skills do i have", "session_id": sid})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "Python" in body["answer"] and "Rust" in body["answer"]
    assert len(body["sources"]) >= 1
    assert "SUPPORTED" in body["validation"]


def test_ask_abstains_without_relevant_evidence(monkeypatch, tmp_path):
    """With documents indexed but nothing matching the question, the API
    abstains clearly instead of inventing an answer or calling the model."""
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.SQLITE_PATH", path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", False)
    sid = str(uuid.uuid4())
    c = TestClient(api.app)
    assert _absorb(c, sid, "resume.txt",
                   "John Doe has Python, TypeScript, and Rust skills.").status_code == 200

    called = {"n": 0}
    def never(messages):
        called["n"] += 1
        raise AssertionError("model must not be called when there is no evidence")

    monkeypatch.setattr(rag_core, "_chat", never)
    r = c.post("/ask", json={"question": "what is the weather forecast", "session_id": sid})
    assert r.status_code == 200, r.text
    body = r.json()
    assert called["n"] == 0
    assert body["sources"] == []
    assert body["answer"] and "don't have relevant information" in body["answer"].lower()


def test_reupload_changed_content_supersedes_stale_facts(monkeypatch, tmp_path):
    """Re-uploading a filename with different content must supersede the old
    document version, remove its stale facts, and keep only the new facts.
    Vector (Chroma) chunks for the filename are replaced by ingest_document_bytes."""
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", True)
    sid = _sid()
    c = TestClient(api.app)

    def fact_chat(value):
        def fake_chat(messages):
            return json.dumps({
                "entities": [],
                "facts": [{
                    "subject": "Revenue", "attribute": "total", "value": value,
                    "value_type": "money", "unit": "USD", "period": "2024",
                    "evidence": f"Revenue was {value}.",
                    "confidence": 0.9,
                }],
                "relationships": [],
            })
        return fake_chat

    monkeypatch.setattr(rag_core, "_chat", fact_chat("$1M"))
    r = _absorb(c, sid, "a.txt", "Revenue was $1M.")
    assert r.status_code == 200, r.text
    docs = intel_store.list_documents(sid, path=path)
    assert len(docs) == 1 and docs[0]["status"] == "indexed"
    facts = intel_store.search_facts(sid, path=path)
    assert len(facts) == 1 and facts[0]["value"] == "$1M"

    # Different content under the same filename: new version, old one superseded.
    monkeypatch.setattr(rag_core, "_chat", fact_chat("$2M"))
    r = _absorb(c, sid, "a.txt", "Revenue was $2M.")
    assert r.status_code == 200, r.text
    docs = intel_store.list_documents(sid, path=path)
    assert len(docs) == 2, docs
    statuses = [d["status"] for d in docs]
    assert statuses.count("superseded") == 1 and statuses.count("indexed") == 1
    facts = intel_store.search_facts(sid, path=path)
    assert len(facts) == 1 and facts[0]["value"] == "$2M"

    # Vector records for the filename were replaced, not accumulated:
    # one filename marker chunk plus one content chunk per version.
    from rag_core import _get_collection
    coll = _get_collection(sid)
    stored = coll.get(include=["metadatas"])
    sources = [m.get("source") for m in (stored.get("metadatas") or [])]
    assert sources.count("a.txt") == 2, sources

    # Identical re-upload is idempotent: no extra rows or facts.
    r = _absorb(c, sid, "a.txt", "Revenue was $2M.")
    assert r.status_code == 200, r.text
    docs = intel_store.list_documents(sid, path=path)
    assert len(docs) == 2
    assert len(intel_store.search_facts(sid, path=path)) == 1


def test_reupload_keeps_unrelated_documents(monkeypatch, tmp_path):
    """Re-processing one document must not touch other documents in the session."""
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", False)
    sid = _sid()
    c = TestClient(api.app)
    assert _absorb(c, sid, "a.txt", "alpha document content.").status_code == 200
    assert _absorb(c, sid, "b.txt", "beta document content.").status_code == 200
    assert len(intel_store.list_documents(sid, path=path)) == 2

    def fake_chat(messages):
        return json.dumps({"entities": [], "facts": [], "relationships": []})
    monkeypatch.setattr(rag_core, "_chat", fake_chat)
    assert _absorb(c, sid, "a.txt", "alpha document content v2.").status_code == 200

    docs = intel_store.list_documents(sid, path=path)
    assert len(docs) == 3
    by_name = {d["filename"]: d for d in docs}
    assert by_name["b.txt"]["status"] == "indexed"
    statuses = [d["status"] for d in docs]
    assert statuses.count("superseded") == 1 and statuses.count("indexed") == 2
    assert len(intel_store.search_facts(sid, path=path)) == 0



