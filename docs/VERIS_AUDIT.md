# Veris — Repository Audit (Phase 0)

Date: 2026-10-15 | Commit: fc9e571 (main)

## 1. Current architecture

```
User -> app.py (Streamlit) --import--> rag_core.py --> Ephemeral Chroma + NVIDIA
User -> api.py (FastAPI: /ask, /documents, /absorb) --import--> rag_core.py
Legacy (dead): ask.py (PersistentClient + ollama), debug.py
```

No workers, queues, auth, or DB besides in-memory Chroma.
`chroma_db/` on disk is stale output from legacy ask.py, NOT used today.
`uploads/` is empty and unused. Ingestion never writes to disk.

## 2. Working features (verified by read + py_compile OK 2026-10-15)

- Upload pdf/docx/txt/md, 10MB cap (app.py:17-36, api.py:30-43).
- Text extraction: pypdf / docx zip+xml w:t / utf-8-sig (rag_core.py:70-86).
- Word chunking ~500 chars + ~50 overlap (rag_core.py:144-163).
- Filename-as-chunk + re-ingest replace by sha256(name) ids (rag_core.py:98-122).
- Per-session isolation session_<uuid>, 1h lazy TTL (rag_core.py:21-41).
- Retrieval: query(n_results=count) then filter dist<=1.5 OR keyword regex.
- Grounded answer + validate -> revise -> re-validate -> abstain (NVIDIA nvidia/llama-3.1-nemotron-70b-instruct).
- Sources = 150-char prefixes + validation string; list_documents; FastAPI + Streamlit paths.
- NVIDIA key from environ -> st.secrets fallback, lazy client.
- Installed: chromadb 1.5.9, openai, pypdf 6.18.1, streamlit 1.63.0,

## 9. Phase 3 migration strategy
Extend, don't rewrite. Rag_core.py remains the single ingest/retrieval layer used by
api.py; the SQLite sidecar is additive (separate schema, WAL, versioned). ChromaDB
stays the vector layer (default ephemeral, opt-in persistent via VERIS_CHROMA_DIR).
No agent frameworks; NVIDIA remains the LLM backbone.

  fastapi 0.141.1, uvicorn 0.52.4, ollama 0.6.2 — requirements.txt pins only 4.

## 3. Incomplete / unverified

1. "ChromaDB persistence" is EphemeralClient (RAM only). Restart wipes data.
2. "Ollama integration" only in dead ask.py CLI. Production is NVIDIA-only.
3. "Hybrid retrieval" = full-scan vector query + regex backstop. No BM25/fusion.
4. n_results=count scans every chunk per question — O(n), slow past hundreds.
5. STOP_WORDS small; regex guards brittle; citations are 150-char prefixes.
6. api.py: no /health, no CORS, raw 500 on NVIDIA failure; UUID-only session check.
7. No tests, CI, lint, type hints. No .env.example. uploads/ unused.

## 4. API contracts (exact)

- POST /ask {question, session_id(UUID)} -> {answer, sources[], validation}.
  400 on non-UUID; 500 on missing NVIDIA key / NVIDIA outage.
- GET /documents?session_id=<UUID> -> {documents: string[]} sorted casefold.
- POST /absorb multipart(file) + form(session_id) -> {filename, chunks_added}.
  400 unsupported type / missing name; 413 over 10MB.
- Streamlit: direct import rag_core; session_id in st.session_state; history list.

## 5. Data flow

Bytes -> ext check -> extract text -> camelCase de-squish -> word-chunk +
filename chunk -> delete old same-source -> add to session_<uuid> collection
-> ask: query all -> filter dist/keyword -> NVIDIA answer -> validate ->
revise -> re-validate -> abstain fallback -> {answer, sources, validation}.

## 6. Deployment

Local: streamlit run app.py (.env NVIDIA_API_KEY) or uvicorn api:app.
Cloud: Streamlit Community Cloud, app.py entry, NVIDIA_API_KEY secret.
Ephemeral: RAM store; restarts wipe. No committed secrets found.

## 7. Risks

R1 requirements.txt omits fastapi/uvicorn in use. R2 ephemeral + full scan.
R3 no tests. R4 constants scattered, no config layer. R5 dead code confusion.
R6 weak citations. R7 NVIDIA-only late failure. R8 same-name re-upload replaces.

## 8. Migration strategy

Extend, don't rewrite. Keep rag_core signatures until replacement beats
regression tests. Phase 1: config.py + .env.example + pinned reqs + offline
tests + /health + logging. Phase 2: FastAPI as record; React vs Streamlit
after parity; keep app.py alive. Phase 3+: SQLite sidecar facts/provenance,
BM25+vector, contradiction/change detection behind flags. No agent frameworks.



