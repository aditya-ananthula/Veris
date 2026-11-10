# Veris resume facts

## Verified inventory

- Frontend: React 18, TypeScript, Vite, and Tailwind utility classes with hand-written global CSS.
- Routes: 9 rendered page routes in [main.tsx](../frontend/src/main.tsx), plus the nested Knowledge layout. The routes include Overview, Documents, Intelligence, Knowledge landing, Document Graph, Chunk Cloud, Entities, Settings, and Help.
- Knowledge visual workspace: 1 workspace with 3 visual views (document graph, chunk cloud, entities and relationships).
- Shared component count: 14 exported function components under [frontend/src/components](../frontend/src/components); this count excludes private helper components and page/layout components.
- Frontend source size: 2,252 lines under `frontend/src` (1,268 TSX, 502 TS, 482 CSS), including tests.
- Backend source size: 2,909 lines across 10 root Python files, including `debug.py` and excluding tests.
- Git history: 15 commits at the current `HEAD`; no commit was created during this work.

## API and analysis capabilities

- [api.py](../api.py) declares 24 FastAPI route decorators.
- Supported upload formats: PDF (`.pdf`), Word (`.docx`), plain text (`.txt`), and Markdown (`.md`).
- `/capabilities` explicitly advertises 6 base features: upload, list documents, grounded Q&A, answer validation, replace-on-reupload, and document deletion.
- Intelligence APIs additionally cover facts/entities/relationships, contradictions, document and claim comparison, chunks, and graph/statistics data. The API does not expose a separate aggregate count for these functions.

## Retrieval behavior

- [rag_core.py](../rag_core.py) targets 500 characters per chunk and approximately 50 characters of overlap. Chunks are assembled on word boundaries, so actual lengths/overlap vary slightly.
- Retrieval requests `n_results=collection.count()`: it queries all stored chunks, not a fixed top-k.
- A chunk is retained when semantic distance is at most `VERIS_DISTANCE_THRESHOLD` (default `1.5`) **or** any non-stopword question term matches the chunk via a case-insensitive word-boundary regex. This is OR-based filtering, not weighted hybrid ranking or a reranking stage.
- All retained chunks are joined into the generation context. If none pass the filter, the code uses the general-knowledge fallback with no document sources.

## Latency evidence

The existing [retrieval-latency.json](./verification/retrieval-latency.json) records 10 warm retrieval/context-preparation runs against a real PDF (`resume.pdf`, 9 stored chunks), with generation stubbed and excluded. Its median is **158.08 ms**. This measurement is present in the repository evidence but was not rerun during the final frontend verification.

## Final verification and background constraint

- `npm run build` and `npm run lint` passed.
- `npm test` passed: 13 tests across 3 files.
- Responsive browser verification passed 63 checks with no page errors at 360, 768, 1280, and 1920 px; the API was served by deterministic browser fixtures.
- Preserve the cosmic background: the `GalaxyBackground` shader and body radial-gradient colors remain unchanged. `MeshGradient` is not mounted.
- No fresh backend integration run was performed as part of this frontend verification.
