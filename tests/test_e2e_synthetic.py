"""Synthetic end-to-end E2E test simulating the full user journey.

Uploads 2 docs, asks supported/unsupported questions, runs contradiction scan,
verifies idempotent rescan, and confirms no raw stack traces reach the client.

Run: venv\\Scripts\\python -m pytest tests/test_e2e_synthetic.py -v
"""
import json
import uuid

import rag_core
from fastapi.testclient import TestClient

import api


def _sid():
    return str(uuid.uuid4())


def _absorb(client, sid, filename, content, extraction_off=False):
    files = {"file": (filename, content.encode("utf-8"))}
    data = {"session_id": sid}
    return client.post("/absorb", files=files, data=data)


def test_e2e_upload_ask_scan_rescan():
    """Full synthetic E2E: upload 2 docs, Q&A, contradiction scan, idempotent rescan."""
    sid = _sid()

    # Monkeypatch _chat so no Groq key / network is needed
    def fake_chat(messages):
        user_text = messages[-1]["content"]
        # Extraction JSON answers
        if "entities" in user_text and "facts" in user_text:
            if "Acme" in user_text:
                return json.dumps({
                    "entities": [{"name": "Acme Corp", "entity_type": "org", "alias_of": ""}],
                    "facts": [{"subject": "Acme Corp", "attribute": "revenue", "value": "$5M",
                               "value_type": "money", "unit": "USD", "period": "Q1 2026",
                               "evidence": "Acme Corp revenue was $5M in Q1 2026.", "confidence": 0.9}],
                    "relationships": [],
                })
            if "Globex" in user_text:
                return json.dumps({
                    "entities": [{"name": "Globex Corp", "entity_type": "org", "alias_of": ""}],
                    "facts": [{"subject": "Globex Corp", "attribute": "revenue", "value": "$8M",
                               "value_type": "money", "unit": "USD", "period": "Q1 2026",
                               "evidence": "Globex Corp revenue was $8M in Q1 2026.", "confidence": 0.9}],
                    "relationships": [],
                })
            return json.dumps({"entities": [], "facts": [], "relationships": []})
        # Validation answers
        if "VERDICT" in user_text or "Rewrite" in user_text or "UNSUPPORTED_CLAIMS" in user_text:
            return "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: ok."
        # Question answering: extract the actual Question: line from the prompt
        question_line = ""
        for line in user_text.splitlines():
            if line.startswith("Question:"):
                question_line = line[len("Question:"):].strip().lower()
                break
        if "revenue" in question_line and ("acme" in question_line or "globex" in question_line):
            return "Acme Corp revenue was $5M."
        return "I don't know based on the provided documents."

    import rag_core as rc
    rc._chat = fake_chat

    client = TestClient(api.app)

    # 1. Health check
    h = client.get("/health")
    assert h.status_code == 200
    assert h.json()["status"] == "ok"

    # 2. Upload 2 documents (supported scenario)
    r1 = _absorb(client, sid, "acme.txt", "Acme Corp revenue was $5M in Q1 2026.")
    assert r1.status_code == 200, r1.text
    assert r1.json()["filename"] == "acme.txt"
    assert r1.json()["chunks_added"] >= 1

    r2 = _absorb(client, sid, "globex.txt", "Globex Corp revenue was $8M in Q1 2026.")
    assert r2.status_code == 200, r2.text
    assert r2.json()["filename"] == "globex.txt"
    assert r2.json()["chunks_added"] >= 1

    docs = client.get("/documents", params={"session_id": sid})
    assert docs.status_code == 200
    assert set(docs.json()["documents"]) == {"acme.txt", "globex.txt"}

    # 3. Ask a supported question (real data in docs)
    ok = client.post("/ask", json={"question": "What was Acme Corp revenue?", "session_id": sid})
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert set(body) == {"answer", "sources", "validation"}
    assert body["answer"]  # non-empty answer

    # 4. Ask an unsupported question (not in docs)
    unsup = client.post("/ask", json={"question": "What is the CEO name?", "session_id": sid})
    assert unsup.status_code == 200, unsup.text
    unsup_body = unsup.json()
    # Either declined or clearly unsupported
    assert "don't know" in unsup_body["answer"].lower() or "I couldn't" in unsup_body["answer"]

    # 5. Contradiction scan
    scan = client.post("/intel/contradictions/scan", params={"session_id": sid})
    assert scan.status_code == 200, scan.text
    scan_body = scan.json()
    assert "total_compared" in scan_body

    # 6. Idempotent rescan: scanning again should not duplicate contradictions
    scan2 = client.post("/intel/contradictions/scan", params={"session_id": sid})
    assert scan2.status_code == 200, scan2.text
    # Conflict count should be stable (not growing on rescan)
    assert scan2.json()["conflicts"] == scan.json()["conflicts"]

    # 7. List contradictions
    contradictions = client.get("/intel/contradictions", params={"session_id": sid})
    assert contradictions.status_code == 200, contradictions.text

    # 8. Verify /ask provider failure returns HTTP 502, not 500 stack trace
    # Simulate a Groq failure by monkeypatching _chat to raise
    def boom_chat(messages):
        raise RuntimeError("Groq provider is down")

    rc._chat = boom_chat
    fail = client.post("/ask", json={"question": "What was Acme Corp revenue?", "session_id": sid})
    assert fail.status_code == 502, fail.text  # 502, not 500
    # No stack trace in response body
    assert "Traceback" not in fail.text
    assert "RuntimeError" not in fail.text

    # 9. List documents meta
    meta = client.get("/documents/meta", params={"session_id": sid})
    assert meta.status_code == 200
    assert len(meta.json()) == 2

    print("E2E synthetic test PASSED: upload → Q&A → scan → idempotent rescan → 502 handling")