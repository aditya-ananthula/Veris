"""Every test uses an isolated registry; tests never write user documents."""
import pytest
import config
import rag_core
_real_chat = rag_core._chat

@pytest.fixture(autouse=True)
def isolated_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "SQLITE_PATH", str(tmp_path / "isolated.db"))
    monkeypatch.setattr(config, "CHROMA_PERSIST_DIR", "")
    monkeypatch.setattr(config, "EXTRACTION_ENABLED", False)
    monkeypatch.setattr(rag_core, "_chat", _real_chat)
