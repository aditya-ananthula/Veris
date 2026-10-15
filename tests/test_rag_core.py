"""Offline regression tests for the existing RAG baseline.

No network, no Groq key, no Ollama needed: LLM calls are monkeypatched.
Run: venv\\Scripts\\python -m pytest tests/ -v
"""
import uuid

import rag_core


def _sid():
    return str(uuid.uuid4())


def test_chunk_text_basic():
    chunks = rag_core._chunk_text("word " * 200)
    assert len(chunks) >= 2
    assert all(c.strip() for c in chunks)


def test_chunk_text_empty():
    assert rag_core._chunk_text("") == []


def test_extract_txt_and_md():
    text = "héllo — plain text"
    out = rag_core._extract_document_text(text.encode("utf-8"), ".txt")
    assert "h" in out and "llo" in out
    out2 = rag_core._extract_document_text(b"# Title\nbody", ".md")
    assert "Title" in out2


def test_extract_unsupported():
    try:
        rag_core._extract_document_text(b"x", ".exe")
    except ValueError as e:
        assert "Unsupported" in str(e)
    else:
        raise AssertionError("expected ValueError")


def test_ingest_list_replace():
    sid = _sid()
    n1 = rag_core.ingest_document_bytes(b"alpha beta gamma " * 20, sid, "notes.txt")
    assert n1 >= 2  # filename chunk + body chunks
    assert rag_core.list_documents(sid) == ["notes.txt"]
    n2 = rag_core.ingest_document_bytes(b"totally different words " * 20, sid, "notes.txt")
    assert n2 >= 2
    assert rag_core.list_documents(sid) == ["notes.txt"]
    # second doc adds, does not clobber first
    rag_core.ingest_document_bytes(b"other doc here " * 20, sid, "b.txt")
    assert sorted([d.lower() for d in rag_core.list_documents(sid)]) == ["b.txt", "notes.txt"]


def test_is_supported_parser():
    assert rag_core._is_supported("VERDICT: SUPPORTED\nREASONING: ok")
    assert rag_core._is_supported("verdict: supported")
    assert not rag_core._is_supported("VERDICT: UNSUPPORTED\nREASONING: bad")
    assert not rag_core._is_supported("VERDICT: PARTIALLY_SUPPORTED\nx")
    assert not rag_core._is_supported("no verdict here")


def test_ask_no_documents():
    res = rag_core.ask_question("anything?", _sid())
    assert res["sources"] == [] and "No documents" in res["answer"]


def test_ask_keyword_fallback_offline(monkeypatch):
    sid = _sid()
    rag_core.ingest_document_bytes(
        b"Veris stores quietly zebra waffles quux123 for retrieval. " * 10,
        sid, "memo.txt",
    )
    # Force semantic distances to look irrelevant so only keyword regex can save it.
    import chromadb

    real_query = chromadb.api.models.Collection.Collection.query

    def far_query(self, **kwargs):
        out = real_query(self, **kwargs)
        out["distances"] = [[99.0] * len(out["distances"][0])]
        return out

    monkeypatch.setattr(
        "chromadb.api.models.Collection.Collection.query", far_query
    )
    monkeypatch.setattr(
        rag_core, "_chat",
        lambda messages: "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: test.",
    )
    # Bypass first answer call, return supported text mentioning the rare token.
    calls = {"n": 0}

    def fake_chat(messages):
        calls["n"] += 1
        if calls["n"] == 1:
            return "The doc mentions quux123 waffles."
        return "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: test."

    monkeypatch.setattr(rag_core, "_chat", fake_chat)
    res = rag_core.ask_question("What is quux123?", sid)
    assert "quux123" in res["answer"].lower()
    assert res["sources"], "keyword fallback should have kept context"


def test_api_contracts_offline(monkeypatch):
    from fastapi.testclient import TestClient
    import api

    monkeypatch.setattr(
        rag_core, "_chat",
        lambda messages: "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: ok.",
    )
    c = TestClient(api.app)
    h = c.get("/health")
    assert h.status_code == 200 and h.json()["status"] == "ok"
    assert "groq_configured" in h.json()
    assert set(h.json()) == {"status", "app", "groq_configured", "model"}
    sid = str(uuid.uuid4())
    r = c.post("/absorb", files={"file": ("a.txt", b"hello world " * 30)}, data={"session_id": sid})
    assert r.status_code == 200 and r.json()["filename"] == "a.txt"
    d = c.get("/documents", params={"session_id": sid})
    assert d.json() == {"documents": ["a.txt"]}
    bad = c.get("/documents", params={"session_id": "not-a-uuid"})
    assert bad.status_code == 400
    bad2 = c.post("/absorb", files={"file": ("a.exe", b"x")}, data={"session_id": sid})
    assert bad2.status_code == 400


def test_documents_meta_and_delete():
    sid = _sid()
    rag_core.ingest_document_bytes(b"alpha beta gamma " * 20, sid, "notes.txt")
    meta = rag_core.get_documents_meta(sid)
    assert len(meta) == 1
    assert meta[0]["filename"] == "notes.txt"
    assert meta[0]["chunks"] >= 2
    assert meta[0]["extension"] == ".txt"
    assert meta[0]["size_chars"] > 0
    removed = rag_core.delete_document(sid, "notes.txt")
    assert removed >= 2
    assert rag_core.list_documents(sid) == []
    assert rag_core.delete_document(sid, "notes.txt") == 0


def test_session_isolation():
    a, b = _sid(), _sid()
    rag_core.ingest_document_bytes(b"session A content " * 20, a, "a.txt")
    rag_core.ingest_document_bytes(b"session B content " * 20, b, "b.txt")
    assert rag_core.list_documents(a) == ["a.txt"]
    assert rag_core.list_documents(b) == ["b.txt"]
    assert rag_core.delete_document(a, "b.txt") == 0


def test_api_phase2_endpoints(monkeypatch):
    from fastapi.testclient import TestClient
    import api

    monkeypatch.setattr(
        rag_core, "_chat",
        lambda messages: "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: ok.",
    )
    c = TestClient(api.app)
    caps = c.get("/capabilities")
    assert caps.status_code == 200
    body = caps.json()
    assert ".pdf" in body["supported_extensions"]
    assert body["max_upload_mb"] == 10.0
    assert body["persistence"] == "ephemeral-in-memory"
    assert "groq_configured" in body and "features" in body
    assert "GROQ" not in str(body).upper() or "groq_configured" in body
    sid = str(uuid.uuid4())
    c.post("/absorb", files={"file": ("m.txt", b"meta check words " * 30)}, data={"session_id": sid})
    m = c.get("/documents/meta", params={"session_id": sid})
    assert m.status_code == 200 and m.json()[0]["filename"] == "m.txt"
    assert m.json()[0]["chunks"] >= 1
    empty = c.post("/ask", json={"question": "   ", "session_id": sid})
    assert empty.status_code == 400  # whitespace-only rejected by handler guard
    ok = c.post("/ask", json={"question": "what words?", "session_id": sid})
    assert ok.status_code == 200 and "answer" in ok.json()
    assert set(ok.json()) == {"answer", "sources", "validation"}
    gone = c.delete(f"/documents/{'nope.txt'}", params={"session_id": sid})
    assert gone.status_code == 404
    deleted = c.delete("/documents/m.txt", params={"session_id": sid})
    assert deleted.status_code == 200 and deleted.json()["chunks_removed"] >= 1
    assert c.get("/documents", params={"session_id": sid}).json() == {"documents": []}


