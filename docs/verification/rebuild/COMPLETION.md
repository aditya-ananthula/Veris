# Rebuild verification — 2026-11-05

This record supersedes older verification and product-state claims in CHANGES.md and RESUME_FACTS.md (both root and docs copies). The interrupted rebuild changes were already present; this continuation reconciled both uploaded change records, reran verification, reviewed rendered screenshots, and added pytest.ini to constrain discovery to tests/.

## Implemented state

The accumulated rebuild addresses persistent vectors and original-file storage, failed/replacement ingestion, source citations, conversational context, source-backed document/entity graphs, embedding projection, comparison evidence, deletion cleanup, and the /intelligence proxy collision. Overview, Documents, Knowledge hub and its three views, Intelligence/comparison/contradictions, Insights, Settings, and Help share the cosmic glass interface. Existing background and NVIDIA configuration were retained during this continuation. No user documents were deleted and no commit, push, or deployment was performed.

## Fresh verification

| Command/check | Result |
| --- | --- |
| `npm.cmd --prefix frontend run build` | Passed, including TypeScript checking |
| `npm.cmd --prefix frontend run lint` | Passed |
| `npm.cmd --prefix frontend test` | 13 tests passed |
| `venv\Scripts\python.exe -m pytest -q` | 62 tests passed after fixing discovery |
| `node scripts/verify-rebuild.mjs` from frontend | 38 checks passed, zero page errors |
| `venv\Scripts\python.exe scripts/verify_live_provider.py` | Passed: upload, extraction, correct answer, three exact chunk citations, SUPPORTED validation |
| Read-only SQLite integrity checks | All three existing databases returned ok |

Browser verification used synthetic documents in isolated storage, real FastAPI/Chroma/SQLite and a deterministic test-only LLM. The separate live workflow used the configured NVIDIA model with synthetic source text and isolated storage. Neither proves arbitrary-document answer accuracy. Browser checks cover uploads, original files, follow-up chat, citation navigation, comparison, contradictions, graph inspectors, responsive overflow at 390/768/1672 px, and confirmed bulk deletion of test records. Unit/integration tests additionally cover PDF page provenance, DOCX extraction, embedding failure, source replacement, legacy missing indexes, projection identity, and cleanup.

Rendered screenshots were inspected for Overview, Documents and inspector, Knowledge hub, Document Graph and inspector, Chunk Cloud, Entities and inspector, chat, comparison, Insights, Settings, Help, and mobile graph. The interface follows the reference layout and palette but does not reproduce the artwork exactly; the procedural orb and graph materials remain visibly different. Small source collections correctly render sparse graphs/clouds.

## Limits retained explicitly

- Existing registry inconsistencies remain: 20 facts and 12 relationships reference missing documents. These predate this verification and were not deleted or reassigned. New deletion/replacement cleanup passes tests. Legacy sources without a vector index are reported as unavailable for search.
- Insights intentionally shows an empty historical-activity state because historical processing events are not stored.
- Document graph links describe extracted-entity overlap, not embedding similarity. Comparisons and synthesis are limited to validated extracted claims; missing evidence is stated rather than filled in.
- The current cloud renders one point per stored chunk using embedding PCA. It does not reproduce the earlier ten decorative sub-markers per chunk.
- Large-collection performance was not benchmarked. Vite reports a bundle-size warning; backend tests report dependency deprecations and frontend tests report React Router future warnings.

Evidence: [browser report](report.json), [live provider](live-workflow.json), [storage audit](storage-audit.json), and screenshots in this directory.
