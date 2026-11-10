# Veris — Changes Log

## Light Glass Rebuild (2026-11-02)

### Design System
- Replaced dark theme (`--bg-deep: #070a12`, transparent-black buttons, smoky surfaces) with **light glass** theme
- New CSS custom properties: `--bg-body` (pastel mesh gradient), `--glass-white` (frosted white surfaces), `--accent` (vivid violet/indigo-to-blue gradient), `--ink` (dark slate text)
- Background: soft pastel mesh (lavender, sky blue, blush, mint) + slow-moving blurred blobs + subtle grain
- Surfaces: frosted white glass (~55-75% opacity), backdrop-blur, 1px white border, soft layered shadows
- All hardcoded colors/radii/type sizes replaced with design tokens

### Buttons
- **Primary**: glowy gradient (violet→indigo→blue) with glow shadow on hover — matches approved upload button style
- **Secondary**: light glass with gradient border on hover
- **Ghost**: transparent fill, fills on hover
- **Destructive**: light fill with danger accent
- **Icon-only**: 40px square, transparent
- All variants: hover, active, focus-visible (cyan ring), disabled states
- Zero translucent-black buttons anywhere

### AI Orb
- Restored to Overview hero (size=300) and AssistantOrb (size=40)
- Luminous glass core with iridescent tendrils (violet/cyan/pink) that curl, tangle, fade softly
- Cursor proximity reaction via onPointerMove
- Thinking state pulses brighter/faster
- Pauses when off-screen (IntersectionObserver), respects prefers-reduced-motion

### Logo
- Removed Veris "V" logo mark everywhere (sidebar, header, favicon references)
- Plain text brand only ("Veris" + "Document intelligence")

### Pages
- **Overview**: hero with AI orb, light glass cards, glow primary button
- **Documents**: light glass panels, filter/sort, upload with progress, delete with confirmation, retry
- **Intelligence**: chat interface with light glass message bubbles, full-height layout, input pinned bottom, citations, streaming state with orb, compare/contradictions tabs
- **Knowledge Graph** (`/knowledge/graph`): full-screen visual, glossy gem nodes sized by chunk count, curved gradient edges by similarity, force-directed layout, hover highlight, slide-in inspector
- **Chunk Cloud** (`/knowledge/chunks`): full-screen visual, luminous particle clusters per document color, hover shows tooltip, click opens passage
- **Entities** (`/knowledge/entities`): mind map with curved bezier links, label chips on links, arrowheads, click re-centers, slide-in detail panel
- **Settings**: dark mode removed, light glass only, appearance info
- **Help**: light glass panels, keyboard shortcuts

### Infrastructure
- `design.css` is the single source of style (replaced 4 conflicting stylesheets)
- `ErrorBoundary` wraps layout to prevent whole-app crashes
- API retry logic (2 retries on 5xx/timeout)
- Sidebar has explicit grid-column placement (was invisible without CSS)
- No zoom/pan controls; visuals auto-fit via ResizeObserver
- All pages responsive 360→1920, no horizontal scroll, no clipped content

### Files Touched
- `frontend/src/styles/design.css` — rewritten (light glass tokens + all components)
- `frontend/src/pages/EntitiesPage.tsx` — rewritten (mind map, full-screen)
- `frontend/src/pages/DocumentGraphPage.tsx` — rewritten (full-screen glossy graph)
- `frontend/src/pages/ChunkCloudPage.tsx` — rewritten (full-screen particle cloud)
- `frontend/src/pages/SettingsPage.tsx` — dark mode removed
- `frontend/src/components/AiOrb.tsx` — unchanged (already light glass compatible)
- `frontend/src/components/Button.tsx` — class references updated
- `frontend/src/main.tsx` — unchanged (already imports design.css)
- `AUDIT.md` — rewritten (light glass scope)
- `CHANGES.md` — this file

### Verification
- `tsc --noEmit` — clean
- `vite build` — clean (~2s, ~12.5kB CSS)
- `vitest run` — 13/13 pass
- `eslint` — 0 warnings
