# Veris UI audit — Light Glass rebuild
Date: 2026-11-02

## Scope
Read every frontend page/component/hook/service/type plus FastAPI routes and retrieval logic before any changes.

## Architecture
- React 18 + TypeScript + Vite + BrowserRouter under `AppLayout`.
- Routes: `/`, `/documents`, `/intelligence`, `/knowledge` + `graph/chunks/entities`, `/settings`, `/help`.
- `KnowledgeLayout` context shares `sessionId` + `refresh` revision. `useSession` reads/writes `localStorage`. `useKnowledgeData` deduplicates/caches 60s.
- FastAPI backend supplies Chroma passages and SQLite facts/entities/relationships. `api.ts` uses `fetch` with timeout + 2 retries.
- Styling: single `design.css` (prior work), Tailwind config present but unused, inline styles.

## Critical: design / visual
- **No light glass theme exists.** Current tokens are dark (`--bg-deep: #070a12`). Buttons transparent-black; surfaces look smoky on light backgrounds.
- **Veris "V" logo mark present** in sidebar brand — must be removed, plain text only.
- **AI orb** `AiOrb.tsx` exists but only used in `AssistantOrb`; Overview hero uses size=300. Spec: restore to hero + chat idle/thinking, redesign with iridescent tendrils on light bg.
- **Sidebar on light background lacks contrast** — `--fg-soft` on white glass too faint.
- **Knowledge pages are split-view**, not full-screen visual pages. Inspector always visible, fixed heights, `knowledge-workspace` min-height 400px (too small).
- **Chunk Cloud / Document Graph / Entities** render as paged grids rather than immersive full-bleed visuals. No mind map layout for entities.
- **MeshGradient.tsx unused legacy** — keep for baseline invariant. **GalaxyBackground.tsx** — keep immutable.

## High: interaction / UX
- **IntelligencePage**: uploads happen correctly now. Cited-evidence works. Contradiction tab works. Composer multiline OK.
- **DocumentsPage**: dragover cancellation present. List-load errors shown. Upload failure partial-refresh gap remains.
- **MessageBubble** exists but unused in main chat — should be primary renderer.
- **MarkdownRenderer** works (fixed double-escape, keys, unclosed fence).
- **AiOrb** needs light-glass redesign: iridescent gradient, cursor reaction, thinking pulse.
- **Settings** theme toggle includes "dark" — spec says light glass only; remove dark option.
- **No skeleton loaders**, minimal empty states, errors have retry but inconsistent styling.
- **Focus-ring consistency** lacking. ARIA mostly present but not comprehensive.
- **Mobile**: sidebar offscreen nav lacks opacity; mobile orb anchor may exceed bounds.
- `veris-kbd` uses `rgba(0,0,0,0.1)` — black translucency, must be removed.

## Medium: code quality
- `types/index.ts` has unused chart/expandable types.
- `DocumentGraphEdge` similarity is shared-entity overlap — must be labeled as such, not semantic percentage.
- `useKnowledgeData` cached data not invalidated by uploads/deletes (partial — `clearKnowledgeCache` exists).
- Hardcoded pixel sizes throughout (174, 142, 520px canvases, fixed 400px heights).
- `Input.tsx` uses inline styles instead of CSS classes.
- `api.ts` backend launch instructions leak into product error messages.

## Backend API contracts (preserved)
`GET /health`, `GET /capabilities`, `POST /ask`, `POST /absorb`, `GET /documents`, `DELETE /documents`, `GET /intel/documents`, `GET /intel/entities`, `GET /intel/relationships`, `GET /intel/document-graph`, `GET /intel/entity/:id`, `GET /intel/chunks`, `POST /intel/contradictions/scan`, `GET /intel/contradictions`, `POST /intel/compare-documents`, `POST /intel/retry/:docId`.

## Acceptance criteria
1. Light glass theme everywhere; no black translucency anywhere.
2. Veris logo mark removed; plain text brand only.
3. AI orb restored to hero + chat, redesigned with tendrils, iridescent on light bg.
4. Button system: primary (glowy), secondary, ghost, destructive, icon — all states.
5. Chat interface rebuilt in light glass, full height, input pinned bottom.
6. Three knowledge pages — full-screen visuals, own route, deep-linkable.
7. Entities = mind map with visible links + labels.
8. Document Graph = glossy gem nodes, curved gradient edges, similarity-labeled.
9. Chunk Cloud = luminous particle clusters per document.
10. No zoom/pan controls. Auto-fit on load/resize via ResizeObserver.
11. Responsive 360→1920, no overflow/clipping.
12. tsc clean, eslint clean, vitest pass, build OK.
13. CHANGES.md + RESUME_FACTS.md.
