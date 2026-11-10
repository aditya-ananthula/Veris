# Veris — Resume Metrics (Read-Only)

## API Endpoints (FastAPI)
| Endpoint | Method | Source |
|---|---|---|
| /health | GET | api.py:142 |
| /capabilities | GET | api.py |
| /ask | POST | api.py |
| /absorb | POST | api.py |
| /documents | GET | api.py |
| /documents/:filename | DELETE | api.py |
| /intel/documents | GET | api.py |
| /intel/entities | GET | api.py |
| /intel/relationships | GET | api.py |
| /intel/document-graph | GET | api.py |
| /intel/entity/:id | GET | api.py |
| /intel/chunks | GET | api.py |
| /intel/contradictions | GET | api.py |
| /intel/contradictions/scan | POST | api.py |
| /intel/compare-documents | POST | api.py |
| /intel/retry/:docId | POST | api.py |

**Total: 16 API endpoints**

## Supported Document Formats
| Format | Source |
|---|---|
| PDF | api.py:15 (pypdf) |
| DOCX | api.py:15 (zip+xml) |
| TXT | api.py:15 (utf-8-sig) |
| MD | api.py:15 |

**Total: 4 formats**

## Chunking
- Chunk size: ~500 chars (rag_core.py:144-163)
- Overlap: ~50 chars (rag_core.py:144-163)
- Filename-as-chunk + re-ingest replace by sha256(name) (rag_core.py:98-122)

## Retrieval
- Vector: ChromaDB query(n_results=count), filter dist<=1.5 OR keyword regex
- Hybrid: full-scan vector query + regex backstop (no BM25/fusion)
- n_results=count scans every chunk per question — O(n)

## Analysis Features
- Document similarity graph (shared entity overlap)
- Entity extraction with facts/provenance
- Relationship extraction
- Cross-document claim comparison (matching/conflict)
- Contradiction scanning with persistence

## Visual Workspaces & Views
| View | Route | Type |
|---|---|---|
| Overview | / | Hero + cards |
| Documents | /documents | Library list |
| Intelligence | /intelligence | Chat + compare + contradictions |
| Document Graph | /knowledge/graph | Full-screen glossy graph |
| Chunk Cloud | /knowledge/chunks | Full-screen particle cloud |
| Entities | /knowledge/entities | Full-screen mind map |
| Settings | /settings | Configuration |
| Help | /help | Documentation |

**Total: 3 visual workspaces, 8 routes**

## Frontend Components & Pages
### Pages (9)
OverviewPage, DocumentsPage, IntelligencePage, KnowledgePage, DocumentGraphPage, ChunkCloudPage, EntitiesPage, SettingsPage, HelpPage

### Components (13)
Button, Input, ErrorBoundary, UploadDropzone, Inspector, MessageBubble, MarkdownRenderer, DocumentUpload, AiOrb, AssistantOrb, GlassGraph, ChunkCloud (ParticleView), DependencyMap

### Lines of Code
- Frontend (src/): ~4,200 lines (TypeScript + TSX + CSS)
- Backend (root .py): ~8,500 lines (Python)

## Build Verification
- `tsc --noEmit`: clean
- `vite build`: clean (~2.2s, ~12.5kB CSS gzipped to 3.5kB)
- `vitest run`: 13/13 tests pass
- `eslint`: 0 warnings

## Retrieval Latency
Not measured — requires NVIDIA_API_KEY and live document retrieval which cannot be run in this environment (sandboxed, no API key configured).
