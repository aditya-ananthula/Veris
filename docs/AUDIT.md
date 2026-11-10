# Veris frontend audit

> Status note: Findings below describe the pre-redesign baseline. The user later clarified that the cosmic background must remain; the existing `GalaxyBackground` and body radial-gradient colors were preserved while the UI surfaces were redesigned.

## Scope and architecture

- React 18, TypeScript, Vite, Tailwind utility output, and hand-written global CSS.
- `main.tsx` owns browser routes. `AppLayout` owns the sidebar, top search, global backdrop, and floating assistant.
- Page data flows through `services/api.ts` to FastAPI. `useSession` owns the browser's session identifier; `useKnowledgeData` caches knowledge responses and pages consume that cache.
- API route groups cover health/capabilities, ask and document ingestion, documents, claims/comparison, contradictions, facts/entities/relationships, chunks, graph, and stats. Frontend routes: Overview, Documents, Intelligence, Knowledge landing, Document Graph, Chunk Cloud, Entities & Relationships, Settings, Help.

## Ranked findings (pre-redesign baseline)

| Rank | Severity | Finding |
|---|---|---|
| 1 | Critical | Requested light theme conflicts with the active dark theme. `index.css`, `tokens.css`, and `workspace.css` define dark surfaces/text; `index.html` sets `class="dark"`. Many page components also use dark Tailwind color utilities. |
| 2 | High | Background and assistant artwork do not meet the requested design. `GalaxyBackground` is a cosmic WebGL effect; `MeshGradient` is not mounted. The existing `AiOrb` is a particulate ring/core, not the requested tendril orb. Overview reserves an empty `#orbpos`; chat has no orb for idle or thinking. |
| 3 | High | Sidebar still renders a custom V logo mark. Brand label is paired with the mark. |
| 4 | High | Knowledge views are not full-area mind-map/cloud compositions. `GlassGraph` uses a grid or a small hub layout and pages nodes; `DependencyMap` reuses it, so entity relationships lack a true recentering mind map, directional links, branch collapse, and expanded-group interaction. `ChunkCloud` uses static particle positions in document circles. |
| 5 | Medium | Chat uses a fixed `70dvh` panel instead of the available viewport, and citation excerpts are text-only rather than clickable source-chunk references. |
| 6 | Medium | Visual styling is split across duplicated token sets, hardcoded colors, Tailwind utilities, and one-off selectors. This makes consistent light surfaces and responsive behavior difficult to maintain. |
| 7 | Medium | Shared inspector is positioned inside the visualization and does not provide modal semantics or a focus trap. Knowledge layout fixes its height while also adding page padding, risking vertical overflow below the top bar. |
| 8 | Low | Appearance settings still describe the theme as “Cosmic glass.” Empty, loading, retry, upload-progress, and reduced-motion behavior exist, but need visual/accessibility verification after the theme change. |

## Page and component inventory

| Surface | Current implementation and observed gap |
|---|---|
| Overview | Upload and navigation cards exist. Hero artwork anchor is empty; title and orb positioning assume the dark cosmic composition. |
| Documents | Search, format filter, sorting, upload, retry, and delete exist. Dense document actions and status colors rely on shared dark tokens. |
| Intelligence | Ask, compare, and contradiction flows exist. Chat has no AI orb, fixed-height layout, and citations show excerpts without chunk links. |
| Knowledge landing | Links to all three visual routes. It is an extra route rather than the primary visual workspace. |
| Document Graph | Uses real documents/edges and selection inspector. Rendering is a paginated generic graph, not a full-canvas, similarity-weighted document composition. |
| Chunk Cloud | Uses real chunk text and counts, supports filtering, inspection, and paging. Particles are static and arranged in bounded circles. |
| Entities & Relationships | Loads real entity and relationship details, filters, and opens source excerpts. It shares the generic graph layout and lacks mind-map recentering, directional arrows, and branch collapse. |
| Settings | Shows live API capabilities and service health. Appearance copy names the old theme. |
| Help | Documents existing upload, evidence, and visual behavior. Theme-specific instructions are limited. |
| `AppLayout` / `Sidebar` | Global search and responsive nav exist. Cosmic canvas and V mark remain; top bar is transparent rather than frosted light glass. |
| `AiOrb` | Current core/aura/grain implementation is used by the floating assistant only. Historical search found this component in repository history, but no earlier `AIOrb` or tendril implementation. |
| `GalaxyBackground` / `MeshGradient` | Cosmic canvas is mounted globally; mesh component is not mounted. |
| Upload components | Capability-aware validation, drag/drop, progress, and per-file errors exist. Upload zone is not the requested vivid primary button treatment. |
| `GlassGraph` / graph wrappers | Shared SVG rendering supports selection, keyboard activation, search, type filtering, and paging. Positioning and graph interactions are generic and constrained. |
| `Inspector` | Displays selected source/entity details and restores prior focus on unmount. It is an in-layout aside without dialog semantics or focus containment. |
| `MessageBubble` / `MarkdownRenderer` | Shows markdown, validation, copied response, and retrieved excerpts. Citation excerpts are not linked to the full stored chunk. |
| Hooks / API client / types | Session and knowledge caching are separate from API contracts. Keep existing API behavior unless the required source-link interaction needs additional evidence identifiers. |

## Sizing, motion, and accessibility

- Main content is capped at 1440px outside Knowledge. Knowledge sets a viewport-relative height on `main` after the top bar, then adds padding; this can exceed the viewport.
- Responsive rules exist around 900px and 760px. Verify 360, 768, 1280, and 1920px after layout changes.
- Graphs have no zoom/pan controls or wheel handlers in the current frontend scan. Keep auto-fit and individual-item inspection; do not add canvas navigation.
- Focus-visible outlines, keyboard-selectable graph nodes, skip link, upload keyboard activation, and reduced-motion rules exist. Verify contrast, mobile navigation, inspector focus behavior, and animation pauses.

## Historical orb search

Searched repository history for `AIOrb`, `AssistantOrb`, and `tendril`. History contains `AiOrb.tsx` with layered rings/core; no earlier tendril-based component was found. The current component is also used by the persistent assistant in `AppLayout`.

## Final background constraint

The cosmic `GalaxyBackground` shader and the body's radial-gradient background remain unchanged. The light-glass treatment applies to panels, controls, and layout surfaces; it does not replace the background. `MeshGradient` remains unmounted.
