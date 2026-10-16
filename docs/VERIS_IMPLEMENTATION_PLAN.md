# Veris — Implementation Plan

Phases from master prompt, scoped to this repo (fc9e571).

## Phase 0 — Audit [DONE 2026-10-15]

- [x] Inspect app.py/api.py/rag_core.py/ask.py/debug.py/reqs/README/env
- [x] docs/VERIS_AUDIT.md
- Baseline: Streamlit+FastAPI share Ephemeral Chroma; Groq-only; no tests.

## Phase 1 — Stable foundation [DONE 2026-10-15]
Result: 9/9 pytest pass; /health OK with no key leakage; chroma_db/ intact;
resume.pdf restored after found missing on disk; watermark PDF untouched.

Tasks:
1. config.py env-first settings (no secrets in code).
2. .env.example placeholders.
3. requirements.txt pin fastapi/uvicorn (+pytest dev note).
4. tests/test_rag_core.py offline (mock _chat): chunking, extract,
   ingest/replace/list, validation parser, API contracts.
5. api.py: GET /health (no secrets), keep all contracts unchanged.
6. Verify: py_compile + pytest + manual ask with mocked LLM.
Acceptance: baseline documented; regression coverage; no hardcoded secrets;
  chroma_db/ + uploads/ untouched; no data destroyed.

## Phase 2 — Frontend redesign [DONE 2026-10-15]

Result: React+TS+Vite+Tailwind app in frontend/ wired to FastAPI via typed
client + dev proxy. 12/12 backend tests, tsc clean, eslint clean, 3/3 vitest,
vite build OK. Live HTTP E2E on :8001: health, capabilities, absorb(9 chunks),
documents, meta, ask reached Groq (403 blocked by sandbox network, proving the
full path executes), delete(9 removed, collection empty). Vite serves 200.
app.py Streamlit untouched as fallback. No secrets in frontend.

## Phase 3 — Ingestion pipeline [NOT STARTED]

- Extend current extract->chunk->embed; add validation, normalization,
  doc registry sidecar (SQLite), provenance (source+offset), retry.
- Keep supported formats; improve reliability; never delete chroma_db/ blindly.

## 9. Phase 3 — Structured Intelligence [DONE 2026-10-15]
- Done: tests/test_intel.py (extraction/persistence/provenance/API-contract, mocked LLM),
  intel_store.py, intel_extract.py, intel_compare.py, intel_contradict.py, rag_core.py,
  api.py endpoints, frontend types/theme, KnowledgePage, api service, routing.
- Verified: 21/21 pytest, tsc clean, eslint clean, vitest 3/3, vite build OK;
  live HTTP cycle on :8002; /intel/documents route fixed.
- Docs: final note added below; data/ and .env in .gitignore; no secrets committed.


## Later — intelligence/eval/product [NOT STARTED]

- Facts/entities/contradictions/change detection behind flags with evals.

