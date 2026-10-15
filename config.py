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


def has_groq_key():
    return bool(os.environ.get("GROQ_API_KEY"))
