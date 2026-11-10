"""Regression cases uncovered by the browser's real API flow."""
from uuid import uuid4
from fastapi.testclient import TestClient
import api
import intel_store
import intel_compare


def test_extracted_types_compare_without_losing_money_suffixes():
    for kind in ("money", "string", "boolean"):
        assert intel_compare.normalize_payload({"value_type": kind}).value_type == "text"
    base = {"subject": "Acme", "attribute": "revenue", "value_type": "money"}
    assert intel_compare.compare(dict(base, value="$5M"), dict(base, value="$5B")).conflict
    assert intel_compare.compare(dict(base, value="$5M"), dict(base, value="$5M")).matching


def test_compare_and_scan_accept_persisted_money_claims(monkeypatch, tmp_path):
    monkeypatch.setattr("config.SQLITE_PATH", str(tmp_path / "test.db"))
    sid = str(uuid4())
    ids = []
    for name, value in (("a.txt", "$5M"), ("b.txt", "$8M")):
        doc = intel_store.upsert_document(sid, name, ".txt", name, 2)
        ids.append(doc)
        intel_store.save_facts(sid, doc, [{"subject": "Acme", "attribute": "revenue", "value": value, "value_type": "money", "evidence": f"Revenue was {value}."}])
    client = TestClient(api.app)
    comparison = client.post("/intel/compare-documents", json={"session_id": sid, "doc_a": ids[0], "doc_b": ids[1]})
    assert comparison.status_code == 200
    assert len(comparison.json()["conflicts"]) == 1
    scan = client.post("/intel/contradictions/scan", params={"session_id": sid})
    assert scan.status_code == 200
    assert scan.json()["conflicts"] == 1


def test_document_similarity_is_actual_entity_set_overlap(monkeypatch, tmp_path):
    monkeypatch.setattr("config.SQLITE_PATH", str(tmp_path / "graph.db"))
    sid = str(uuid4())
    shared = intel_store.upsert_entity(sid, "Shared")
    unique = intel_store.upsert_entity(sid, "Unique")
    ids = []
    for name, entities in (("a.txt", [shared, unique]), ("b.txt", [shared])):
        doc = intel_store.upsert_document(sid, name, ".txt", name, 2)
        ids.append(doc)
        intel_store.save_facts(sid, doc, [{"subject": eid, "attribute": "value", "value": "x", "entity_id": eid} for eid in entities])
    graph = intel_store.get_document_graph(sid)
    assert len(graph["edges"]) == 1
    assert graph["edges"][0]["similarity"] == 0.5
    assert graph["edges"][0]["shared_entities"] == [{"entity_id": shared, "name": "Shared"}]
    assert graph["edges"][0]["evidence"] == "Shared entities: Shared"


def test_capabilities_report_configured_persistence(monkeypatch):
    monkeypatch.setattr("config.CHROMA_PERSIST_DIR", "test-persist")
    assert api.capabilities()["persistence"] == "persistent-on-disk"
