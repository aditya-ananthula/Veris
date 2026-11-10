from pathlib import Path
for name in ['tests/test_rag_core.py','tests/test_intel.py','tests/test_e2e_synthetic.py']:
 p=Path(name);s=p.read_text(encoding='utf-8')
 s=s.replace('{"answer", "sources", "validation"}', '{"answer", "sources", "validation", "citations"}')
 s=s.replace('"status", "extraction_status", "extraction_error", "chunks"}', '"status", "extraction_status", "extraction_error", "chunks", "created_at", "size_bytes", "source_available", "key_topics", "summary", "entity_count"}')
 s=s.replace('assert "general knowledge" in res["validation"].lower()', 'assert res["validation"] == "VERDICT: INSUFFICIENT_EVIDENCE"')
 s=s.replace('assert "speed of light" in res["answer"].lower()', 'assert "provided documents" in res["answer"].lower()')
 s=s.replace('assert called["n"] == 1', 'assert called["n"] == 0')
 s=s.replace('assert "weather" in body["answer"].lower()', 'assert "provided documents" in body["answer"].lower()')
 s=s.replace('assert "general knowledge" in body["validation"].lower()', 'assert body["validation"] == "VERDICT: INSUFFICIENT_EVIDENCE"')
 s=s.replace('def test_e2e_upload_ask_scan_rescan():','def test_e2e_upload_ask_scan_rescan(monkeypatch):\n    monkeypatch.setattr("config.EXTRACTION_ENABLED", True)')
 p.write_text(s,encoding='utf-8')
