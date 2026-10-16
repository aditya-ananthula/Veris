"""Central configuration. Env-first, no secrets in code."""
import os


def _int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (ValueError, TypeError):
        return default


def _float(name, default):
    try:
        return float(os.environ.get(name, default))
    except (ValueError, TypeError):
        return default


APP_NAME = os.environ.get("VERIS_APP_NAME", "Veris API")
GROQ_MODEL = os.environ.get("VERIS_GROQ_MODEL", "openai/gpt-oss-20b")
DISTANCE_THRESHOLD = _float("VERIS_DISTANCE_THRESHOLD", 1.5)
MAX_UPLOAD_BYTES = _int("VERIS_MAX_UPLOAD_BYTES", 10 * 1024 * 1024)
SESSION_TTL_SECONDS = _int("VERIS_SESSION_TTL_SECONDS", 3600)
LOG_LEVEL = os.environ.get("VERIS_LOG_LEVEL", "INFO")
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("VERIS_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

DATA_DIR = os.environ.get("VERIS_DATA_DIR", "data")
SQLITE_PATH = os.environ.get("VERIS_SQLITE_PATH", os.path.join(DATA_DIR, "veris.db"))
# Persistent Chroma is opt-in: unset/empty keeps the Phase 1-2 ephemeral behavior.
CHROMA_PERSIST_DIR = os.environ.get("VERIS_CHROMA_DIR", "").strip()
# Structured extraction runs inline after upload; "off" keeps RAG-only behavior.
EXTRACTION_ENABLED = os.environ.get("VERIS_EXTRACTION_ENABLED", "on").lower() not in {"0", "off", "false", "no"}
EXTRACTION_MAX_CHARS = _int("VERIS_EXTRACTION_MAX_CHARS", 12000)
EXTRACTION_TIMEOUT_S = _int("VERIS_EXTRACTION_TIMEOUT_S", 90)
EXTRACTION_MAX_RETRIES = _int("VERIS_EXTRACTION_MAX_RETRIES", 1)


def has_groq_key():
    return bool(os.environ.get("GROQ_API_KEY"))
