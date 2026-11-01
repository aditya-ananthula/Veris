# Veris UI audit — 2026-11-02

## Scope and baseline

Read every frontend page, component, hook, service, type and configuration, plus FastAPI routes, retrieval, and SQLite graph/detail queries before implementation. The worktree already contains extensive staged and unstaged work; it is the baseline, not HEAD. Preserve existing work. No AGENTS.md was found. The supplied attachment is the reference (the proposed docs/reference path does not yet exist).

Hard invariant: preserve GalaxyBackground.tsx, its mount/props, body background, #gl rules, background tokens and overview orb anchor geometry. Store a baseline and compare these explicitly. Reference targets are luminous icon nodes, translucent panels, readable chips, restrained cyan/violet glow; reference numbers are not data.

## Architecture

React 18 + TypeScript, Vite, BrowserRouter nested under AppLayout. Routes: /, /documents, /intelligence, /knowledge and graph/chunks/entities children, /settings, /help. KnowledgeLayout context shares session and refresh revision. useSession reads browser localStorage; useKnowledgeData deduplicates requests and caches for 60 seconds. Other pages use local effects/state. FastAPI supplies Chroma passages and SQLite facts/entities/relationships. API service uses fetch with timeout. Styling mixes Tailwind utilities, duplicate CSS blocks, inline styles and undefined accent/ink Tailwind tokens.

## Ranked findings

### Critical functional gaps

- IntelligencePage: attachment filenames are appended to questions without uploading bytes; cited-evidence button does nothing; contradiction tab is a placeholder; comparison throws away returned claims/evidence. Search query effect can miss navigation updates or duplicate questions. Composer promises multiline while using input. Errors loading documents are swallowed.
- GlassGraph / ChunkCloud: zoom, wheel zoom, drag-pan, fit buttons and expanded view violate explicit requirements. Entire collections shrink into fixed 520px canvases; tiny labels become unreadable. No bounded graph rendering or real hover highlight. Ten markers per chunk are decoration, not ten chunks.
- DocumentsPage: missing dragover cancellation can break drops; list-load errors silently appear as empty collections; upload failure skips list refresh after partial success. Status conflates indexed with extraction complete. Force-remove offers local-only deletion, hiding backend errors.

### High: layout, navigation, evidence

- KnowledgeLayout: generic title/description on every child; no per-page stats; loading is plain text; retry is instructions rather than a button. DocumentGraphPage / EntitiesPage: always-visible inspector takes visual space, drops below at <=1200px and causes page scrolling. Fixed-height visual plus headings exceeds viewport. No legend. Filters only dim nodes in graph. Selection can remain out of filter context.
- DocumentGraphPage: real edge weights ignored by drawing. Backend similarity is a count-derived heuristic, not measured embedding similarity (intel_store.get_document_graph). Do not present as semantic percentage.
- EntitiesPage: no document filter; detail has fact evidence but no direct passage navigation; all relationship labels are ambiguous arrows; detail failures lack retry.
- ChunkCloud: all particles and labels rendered regardless of size; canvas has no hover tooltip; passage list exists but visual accessibility is weak; large groups are not paged.
- AppLayout: Ctrl K is advertised but not implemented; main remounts on every route; no skip link. Sidebar: invalid JSX SVG attributes cause console warnings; offscreen mobile nav is keyboard focusable, lacks expanded state/Escape behavior and an opaque enough mobile surface.
- OverviewPage: duplicate upload implementation with global DOM toast, no progress or disabled state; Compare links to Ask; all four cards have oversized fixed minimums.
- SettingsPage: no retry/loading; defaults claim server settings before fetching; theme radio has no associated label or behavior; empty Danger Zone creates misleading warnings.
- HelpPage: claims raw uploads are stored on disk, calls chunk layout semantic neighborhoods, claims isolation without noting session identifier limitations, and documents a nonfunctional shortcut.

### Medium: component and styling inventory

- ui.tsx: numerous unused primitives; Button does not forward click props, Input uses any; inconsistent control states/sizing and translucent error contrast.
- UploadDropzone: reusable but unused, keyboard Space scrolls, hidden input click bubbles, aria-disabled missing, no upload progress.
- MessageBubble: useful but unused; clipboard success shown before promise resolves; source excerpts available but plain answer formatting. Integrate it rather than duplicate.
- MarkdownRenderer: double-escapes text React already escapes, repeated inline keys, recursive shared regex state, unvalidated links, unclosed code fence loses final line; narrow table/code containers need internal overflow.
- AiOrb / AssistantOrb: assistant lacks visible busy status, evidence and keyboard dismissal; can obscure bottom controls. Orb visual remains stylistically compatible.
- RankedDocumentGraph / DependencyMap: thin adapters with corrupted separators, no node size/connection semantics. charts/index: correct active exports.
- knowledgeLayout: deterministic layout is useful but fixed square grids and unbounded particle generation are not responsive; palette separate from CSS.
- useKnowledgeData: cached data not invalidated by uploads/deletes. useSession: no handling of unavailable localStorage. api.ts: timeout ends before response body, technical backend launch instructions leak into product error; otherwise shared service is reusable.
- types/index: unused chart/expandable types left from deleted charts; DocumentGraphEdge omits backend similarity.
- main: routes already separated and deep-linkable; preserve route contracts. KnowledgePage: useful index, but question marks replace punctuation and loading counts.
- styles/index.css: repeated button/tab/surface rules, undefined --btn-gradient, dozens of hardcoded colors/radii/type sizes. body overflow hidden masks problems; Documents filter widths exceed mobile width; mobile orb anchor may extend page bounds. Background styles must be retained separately from cleanup.
- MeshGradient: unused legacy background; preserve file for hard background invariant rather than repurpose it. GalaxyBackground: approved shader is immutable for this task; existing reduced-motion cleanup issue is outside scope.
- Tests: duplicate sanity tests; marker test mirrors an implementation constant; missing route/layout/interaction regressions. Frontend config supports lint/type/build; browser automation dependency already installed locally. Vite /documents proxy collides with the browser route on hard reload.

## Implementation acceptance

1. Tokenized shared controls and surfaces, accessible focus, meaningful loading/empty/errors/retries, responsive all pages.
2. Three independent viewport-contained visual pages, own heading/stats/filters/legend, inspect on click, ResizeObserver fitting without any zoom/pan/fullscreen; bounded paging maintains readable nodes at 5/500 sizes. Node/edge facts come from API.
3. Complete upload, question/citations, compare and contradiction flows using existing contracts; preserve data and session behavior.
4. Typecheck, lint, build, meaningful component and backend tests; run all routes at 360/768/1280/1920 and inspect rendered artifacts including populated visuals and error/empty states.
5. Background baseline diff, CHANGES.md and countable RESUME_FACTS.md, measured latency only if real document retrieval runs.

## Design decision

Use responsive SVG with measured pixel coordinates and bounded pages, never scale text below readable size. Emphasize highest-degree entity as a central hub when space permits; use collision-free cells on narrow screens. Use a single particle per stored chunk, paged document clusters and passage access, with honest totals. Side inspectors overlay on smaller widths, keeping page size stable. Retain backend evidence weighting, explicitly label its shared-connection basis rather than invent semantic similarity.
