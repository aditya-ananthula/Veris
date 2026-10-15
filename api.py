from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
from uuid import UUID
import logging
import rag_core
import config

logging.basicConfig(level=getattr(logging, config.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("veris")

MAX_UPLOAD_BYTES = config.MAX_UPLOAD_BYTES
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}

app = FastAPI(title=config.APP_NAME)

origins = config.ALLOWED_ORIGINS or [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    session_id: str


class AskResponse(BaseModel):
    answer: str
    sources: list[str]
    validation: str


class DocumentsResponse(BaseModel):
    documents: list[str]


class AbsorbResponse(BaseModel):
    filename: str
    chunks_added: int


class HealthResponse(BaseModel):
    status: str
    app: str
    groq_configured: bool
    model: str


class CapabilitiesResponse(BaseModel):
    supported_extensions: list[str]
    max_upload_bytes: int
    max_upload_mb: float
    llm_model: str
    groq_configured: bool
    session_ttl_seconds: int
    persistence: str
    features: list[str]


class DocumentMeta(BaseModel):
    filename: str
    chunks: int
    extension: str
    size_chars: int


def _profile_id(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid browser profile")


@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "app": config.APP_NAME,
        "groq_configured": config.has_groq_key(),
        "model": config.GROQ_MODEL,
    }


@app.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities():
    return {
        "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "max_upload_mb": round(MAX_UPLOAD_BYTES / (1024 * 1024), 1),
        "llm_model": config.GROQ_MODEL,
        "groq_configured": config.has_groq_key(),
        "session_ttl_seconds": config.SESSION_TTL_SECONDS,
        "persistence": "ephemeral-in-memory",
        "features": [
            "upload",
            "list-documents",
            "ask-grounded-qa",
            "validation",
            "replace-on-reupload",
            "delete-document",
        ],
    }

@app.post("/ask", response_model=AskResponse)
def ask(payload: Question):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty")
    try:
        return rag_core.ask_question(payload.question, _profile_id(payload.session_id))
    except RuntimeError as e:
        # Missing Groq key / provider misconfiguration -> 502, no secret leakage.
        raise HTTPException(status_code=502, detail=str(e))

@app.get("/documents", response_model=DocumentsResponse)
def documents(session_id: str):
    return {"documents": rag_core.list_documents(_profile_id(session_id))}


@app.get("/documents/meta", response_model=list[DocumentMeta])
def documents_meta(session_id: str):
    profile_id = _profile_id(session_id)
    return rag_core.get_documents_meta(profile_id)


@app.delete("/documents/{filename}")
def delete_document(filename: str, session_id: str):
    profile_id = _profile_id(session_id)
    safe_name = os.path.basename(filename.replace("\\", "/"))
    if not safe_name:
        raise HTTPException(status_code=400, detail="A filename is required")
    removed = rag_core.delete_document(profile_id, safe_name)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Document not found in this session")
    return {"filename": safe_name, "chunks_removed": removed}

@app.post("/absorb")
def absorb(file: UploadFile, session_id: str = Form(...)):
    profile_id = _profile_id(session_id)
    filename = os.path.basename((file.filename or "").replace("\\", "/"))
    extension = os.path.splitext(filename)[1].lower()
    if extension not in {".pdf", ".docx", ".txt", ".md"}:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    if not filename:
        raise HTTPException(status_code=400, detail="A filename is required")

    file_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Documents must be 10 MB or smaller")
    num_chunks = rag_core.ingest_document_bytes(file_bytes, profile_id, doc_id_prefix=filename)
    return {"filename": filename, "chunks_added": num_chunks}