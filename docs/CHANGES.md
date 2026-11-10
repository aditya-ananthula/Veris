# Changes

## Interface redesign

- Added light-glass surfaces, shared styling tokens, and responsive workspace layouts without replacing the existing cosmic background.
- Added the reusable animated AI orb to Overview and Intelligence, including idle/thinking/speaking states, reduced-motion handling, and visibility-based pausing.
- Updated the Knowledge views with mind-map positioning, directional relationship labels, chunk-cloud motion, and paging affordances.
- Made answer evidence citations open the matching stored passage in the Knowledge chunk inspector.
- Updated navigation branding, action button treatments, and appearance/citation guidance.
- Added tests for citation navigation and mind-map behavior.
- Fixed a JSX comment placement in the unused `MeshGradient` component that prevented TypeScript compilation; its visual implementation was not changed.

## Background constraint

The cosmic `GalaxyBackground` shader and the existing body radial-gradient colors are preserved. No replacement background was introduced.

## Verification

- `npm run build` - passed.
- `npm run lint` - passed.
- `npm test` - passed: 13 tests.
- Responsive browser verification - passed: 63 checks, no failed checks or page errors, at 360, 768, 1280, and 1920 px. Browser API responses used deterministic test fixtures.
