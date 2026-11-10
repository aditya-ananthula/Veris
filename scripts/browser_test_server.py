"""Isolated browser-test API. Real indexing/storage/routes, deterministic test-only LLM."""
import os, sys, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["VERIS_SQLITE_PATH"] = str(ROOT / "docs/verification/browser-test.db")
os.environ["VERIS_CHROMA_DIR"] = ""
os.environ["VERIS_EXTRACTION_ENABLED"] = "on"
import api, rag_core

def chat(messages):
    prompt = messages[-1]["content"]
    if "entities" in prompt and "facts" in prompt:
        value = "$8M" if "$8M" in prompt else "$5M"
        evidence = f"Acme Corp revenue was {value} in Q1 2026."
        return json.dumps({
            "entities":[{"name":"Acme Corp","entity_type":"org","alias_of":""}],
            "facts":[{"subject":"Acme Corp","attribute":"revenue","value":value,"value_type":"money","unit":"USD","period":"Q1 2026","evidence":evidence,"confidence":0.99}],
            "relationships":[]
        })
    if "VERDICT" in prompt:
        return "VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: Test evidence."
    return "Acme Corp revenue was $5M in Q1 2026."
rag_core._chat = chat
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api.app, host="127.0.0.1", port=8008)
