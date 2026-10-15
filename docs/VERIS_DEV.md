# Veris — Local development (Windows PowerShell)

## Backend (FastAPI, port 8000)

```powershell
cd c:\Projects\Veris
.\venv\Scripts\Activate.ps1
uvicorn api:app --reload --port 8000
```

Health: http://127.0.0.1:8000/health · Capabilities: /capabilities ·
Docs: /documents · Ask: POST /ask · Upload: POST /absorb

Requires `GROQ_API_KEY` in `.env` (see `.env.example`) for live answers.
Without it, `/ask` returns HTTP 502 with a plain message (no secret leakage).

## Frontend (React + Vite, port 5173)

```powershell
cd c:\Projects\Veris\frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. Dev proxy forwards `/ask /documents /absorb
/health /capabilities` to `http://127.0.0.1:8000`, so no frontend env is
needed locally. For a custom backend set `VITE_API_BASE_URL` (see `.env.example`).

## Checks

```powershell
# backend (12 tests, mocked LLM — no key needed)
.\venv\Scripts\python -m pytest tests/ -v

# frontend
cd frontend
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest run (jsdom)
npm run build       # tsc + vite build -> frontend/dist
```

## Notes

- Streamlit fallback untouched: `streamlit run app.py`.
- Port 8000 may be taken by another app in shared environments; Veris was
  E2E-verified on 8001 with identical results.
- ChromaDB is ephemeral in-memory; backend restarts clear sessions.
- Never put `GROQ_API_KEY` in `frontend/.env` — the browser must not hold secrets.
