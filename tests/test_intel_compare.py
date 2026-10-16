"""Phase 4 acceptance tests: claim comparison, contradiction scanning, persistence, API endpoints."""

import json
import uuid

import intel_compare
import intel_contradict
import intel_store

import config


def _sid():
    return str(uuid.uuid4())


def _tmpdb(monkeypatch, tmp_path):
    path = str(tmp_path / "veris_test.db")
    monkeypatch.setattr("config.SQLITE_PATH", path)
    intel_store.init_db(path)
    intel_contradict.init_db(path)
    return path


# ---------------------------------------------------------------------------
# 1. Direct claim comparison (intel_compare.compare) — no LLM
# ---------------------------------------------------------------------------

def test_comparison_matching_claims():
    c1 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    res = intel_compare.compare(c1, c2)
    assert res.matching is True
    assert res.conflict is False
    assert res.category == "match"


def test_comparison_genuine_conflict_numeric():
    c1 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "1500000", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    res = intel_compare.compare(c1, c2)
    assert res.matching is False
    assert res.conflict is True
    assert res.category == "conflict"
    assert "differ" in res.explanation


def test_comparison_missing_values_treated_as_text():
    c1 = {"subject": "Revenue", "attribute": "total", "value": "", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    res = intel_compare.compare(c1, c2)
    assert res.matching is True
    assert res.category == "match"


def test_comparison_reporting_period_difference():
    c1 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coA", "period": "2023"}
    res = intel_compare.compare(c1, c2)
    assert res.matching is False
    assert res.conflict is False
    assert res.category == "period-difference"
    assert "period" in res.explanation.lower()


def test_comparison_entity_mismatch():
    c1 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coA", "period": "2024"}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coB", "period": "2024"}
    res = intel_compare.compare(c1, c2)
    assert res.matching is False
    assert res.conflict is False
    assert res.category == "entity-mismatch"


def test_comparison_date_conflict():
    c1 = {"subject": "Filing", "attribute": "date", "value": "2024-01-15", "value_type": "date",
          "entity_id": "coA", "period": "Q1"}
    c2 = {"subject": "Filing", "attribute": "date", "value": "2024-06-15", "value_type": "date",
          "entity_id": "coA", "period": "Q1"}
    res = intel_compare.compare(c1, c2)
    assert res.matching is False
    assert res.conflict is True
    assert res.category == "conflict"


def test_comparison_low_confidence_downgrades_to_uncertain():
    c1 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "entity_id": "coA", "period": "2024", "confidence": 0.3}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "1500000", "value_type": "number",
          "entity_id": "coA", "period": "2024", "confidence": 0.3}
    res = intel_compare.compare(c1, c2)
    assert res.category == "uncertain"

# ---------------------------------------------------------------------------
# 2. Contradiction scanning (intel_contradict.scan_contradictions) — persistence
# ---------------------------------------------------------------------------

def test_scan_detects_conflict_across_documents(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    d1 = _mk_doc(sid, "a.txt", path)
    d2 = _mk_doc(sid, "b.txt", path)
    _mk_fact(sid, d1, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    _mk_fact(sid, d2, "Acme Corp", "revenue", "$8M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $8M.", path=path)
    result = intel_contradict.scan_contradictions(sid, path=path)
    assert result["total_compared"] >= 1
    assert result["conflicts"] >= 1
    assert len(result["records"]) >= 1
    rec = result["records"][0]
    assert rec["category"] == "conflict"
    assert rec["subject"] == "acme corp"
    assert rec["attribute"] == "revenue"
    assert rec["doc_a"] and rec["doc_b"]
    assert rec["doc_a"] != rec["doc_b"]
    assert rec["fact_a_id"] and rec["fact_b_id"]
    assert rec["evidence_a"] and rec["evidence_b"]
    assert rec["status"] == "open"


def test_scan_no_conflicts_when_consistent(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    d1 = _mk_doc(sid, "a.txt", path)
    d2 = _mk_doc(sid, "b.txt", path)
    _mk_fact(sid, d1, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    _mk_fact(sid, d2, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    result = intel_contradict.scan_contradictions(sid, path=path)
    assert result["conflicts"] == 0
    assert result["matches"] >= 1


def test_scan_duplicate_free_rescan(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    d1 = _mk_doc(sid, "a.txt", path)
    d2 = _mk_doc(sid, "b.txt", path)
    _mk_fact(sid, d1, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    _mk_fact(sid, d2, "Acme Corp", "revenue", "$8M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $8M.", path=path)
    r1 = intel_contradict.scan_contradictions(sid, path=path)
    count1 = len(r1["records"])
    r2 = intel_contradict.scan_contradictions(sid, path=path)
    count2 = len(r2["records"])

def test_scan_persists_and_list_contradictions(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    d1 = _mk_doc(sid, "a.txt", path)
    d2 = _mk_doc(sid, "b.txt", path)
    _mk_fact(sid, d1, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    _mk_fact(sid, d2, "Acme Corp", "revenue", "$8M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $8M.", path=path)
    scan = intel_contradict.scan_contradictions(sid, path=path)
    assert scan["conflicts"] >= 1
    listed = intel_contradict.list_contradictions(sid, path=path)
    assert len(listed) >= 1
    first_id = listed[0]["conflict_id"]
    detail = intel_contradict.get_contradiction(first_id, path=path)
    assert detail is not None
    assert detail["conflict_id"] == first_id
    assert detail["session_id"] == sid
    assert detail["category"] == "conflict"
    assert detail["evidence_a"] and detail["evidence_b"]


def test_scan_stats_aggregate(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    d1 = _mk_doc(sid, "a.txt", path)
    d2 = _mk_doc(sid, "b.txt", path)
    _mk_fact(sid, d1, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    _mk_fact(sid, d2, "Acme Corp", "revenue", "$8M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $8M.", path=path)
    intel_contradict.scan_contradictions(sid, path=path)
    stats = intel_contradict.get_contradiction_stats(sid, path=path)
    assert stats["session_id"] == sid
    assert stats["total"] >= 1
    assert stats["open"] >= 1
    assert stats["resolved"] == 0
    assert stats["dismissed"] == 0
    assert "conflict" in stats["by_category"]


def test_scan_update_contradiction_status(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    d1 = _mk_doc(sid, "a.txt", path)
    d2 = _mk_doc(sid, "b.txt", path)
    _mk_fact(sid, d1, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    _mk_fact(sid, d2, "Acme Corp", "revenue", "$8M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $8M.", path=path)
    scan = intel_contradict.scan_contradictions(sid, path=path)
    conflict_id = scan["records"][0]["conflict_id"]
    updated = intel_contradict.update_contradiction(conflict_id, {"status": "resolved"}, path=path)
    assert updated is not None
    assert updated["status"] == "resolved"
    detail = intel_contradict.get_contradiction(conflict_id, path=path)
    assert detail["status"] == "resolved"


def test_scan_empty_session_no_crash(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    sid = _sid()
    result = intel_contradict.scan_contradictions(sid, path=path)
    assert result["total_compared"] == 0
    assert result["conflicts"] == 0
    assert result["matches"] == 0
    assert result["records"] == []


# ---------------------------------------------------------------------------
# 3. API endpoints (FastAPI TestClient) — return and persist results
# ---------------------------------------------------------------------------

def test_api_compare_endpoint(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.SQLITE_PATH", path)
    import api
    from fastapi.testclient import TestClient
    c = TestClient(api.app)
    claim_a = {"subject": "Revenue", "attribute": "total", "value": "1000000",
               "value_type": "number", "entity_id": "coA", "period": "2024"}
    claim_b = {"subject": "Revenue", "attribute": "total", "value": "1500000",
               "value_type": "number", "entity_id": "coA", "period": "2024"}
    r = c.post("/intel/compare", json={"claim_a": claim_a, "claim_b": claim_b,
                                       "source_doc_id_a": "d1", "source_doc_id_b": "d2"})
    assert r.status_code == 200
    body = r.json()
    assert body["matching"] is False
    assert body["conflict"] is True
    assert body["category"] == "conflict"
    assert "preserved" in body


def test_api_scan_and_stats_endpoints(monkeypatch, tmp_path):
    path = _tmpdb(monkeypatch, tmp_path)
    monkeypatch.setattr("config.SQLITE_PATH", path)
    monkeypatch.setattr("config.EXTRACTION_ENABLED", False)
    import api
    from fastapi.testclient import TestClient
    c = TestClient(api.app)
    sid = str(uuid.uuid4())
    d1 = _mk_doc(sid, "a.txt", path)
    d2 = _mk_doc(sid, "b.txt", path)
    _mk_fact(sid, d1, "Acme Corp", "revenue", "$5M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $5M.", path=path)
    _mk_fact(sid, d2, "Acme Corp", "revenue", "$8M", value_type="number", unit="USD",
             period="Q1 2026", entity_id="acme", evidence="Acme Corp revenue was $8M.", path=path)

    r = c.post("/intel/contradictions/scan", params={"session_id": sid})
    assert r.status_code == 200
    scan_body = r.json()
    assert scan_body["session_id"] == sid
    assert scan_body["conflicts"] >= 1
    assert len(scan_body["records"]) >= 1

    r2 = c.get("/intel/contradictions/stats", params={"session_id": sid})
    assert r2.status_code == 200
    stats_body = r2.json()
    assert stats_body["session_id"] == sid
    assert stats_body["total"] >= 1
    assert stats_body["open"] >= 1

    r3 = c.get("/intel/contradictions", params={"session_id": sid})
    assert r3.status_code == 200
    assert len(r3.json()["conflicts"]) >= 1

    cid = r3.json()["conflicts"][0]["conflict_id"]
    r4 = c.get(f"/intel/contradictions/{cid}", params={"session_id": sid})
    assert r4.status_code == 200
    assert r4.json()["conflict_id"] == cid

    r5 = c.patch(f"/intel/contradictions/{cid}", params={"session_id": sid},
                 json={"status": "resolved"})
    assert r5.status_code == 200
    assert r5.json()["status"] == "resolved"


def test_comparison_preserves_provenance():
    c1 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number",
          "unit": "USD", "period": "2024", "entity_id": "coA", "evidence": "Revenue was $1M.",
          "confidence": 0.9, "source_doc_id": "doc1"}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "1500000", "value_type": "number",
          "unit": "USD", "period": "2024", "entity_id": "coA", "evidence": "Revenue was $1.5M.",
          "confidence": 0.9, "source_doc_id": "doc2"}
    res = intel_compare.compare(c1, c2)
    assert "claim_a" in res.preserved
    assert "claim_b" in res.preserved
    assert res.preserved["claim_a"]["source_doc_id"] == "doc1"
    assert res.preserved["claim_b"]["source_doc_id"] == "doc2"
    assert res.preserved["claim_a"]["evidence"] == "Revenue was $1M."

def _mk_doc(sid, filename, path):
    return intel_store.upsert_document(sid, filename, ".txt", "h1", 1, path=path)


def _mk_fact(sid, doc_id, subject, attribute, value, value_type="text", unit=None, period=None,
             entity_id=None, evidence="", confidence=1.0, status="validated", path=None):
    fact = {
        "subject": subject,
        "attribute": attribute,
        "value": value,
        "value_type": value_type,
        "unit": unit,
        "period": period,
        "entity_id": entity_id,
        "evidence": evidence,
        "confidence": confidence,
        "status": status,
        "char_start": 0,
        "char_end": len(evidence),
        "validation_notes": "",
    }
    intel_store.save_facts(sid, doc_id, [fact], path=path)