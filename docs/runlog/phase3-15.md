# phase3-15 ui viewers

ROWS: CAPY-435..442,504..507,510,511,513

Verification:
- `cd apps/web && pnpm exec vitest run src/features/ui-viewers/ui-viewers.test.tsx` — 1 passed
- `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` — passed

Implemented:
- CAPY-437: built-in/custom theme validation, persisted theme selection, code font size bounds and scroll-new-messages preference in the web appearance slice.
- CAPY-438/510: Explore model filters private entries, sorts popular items and recommends entries matching the project stack; `/viewers` exposes the fixture-backed slice.
- CAPY-439: settings search and grouped settings map.
- CAPY-506: terminal link extraction, find hits and success/failure exit-line classes.
- CAPY-513: deterministic single-HTML generated page shell with viewport and Flotilla-style baseline CSS.

Partial foundations but blocked rows:
- CAPY-435: viewer kind detection, 2 MB text cap, CSV parsing/sorting, source-toggle semantics and media-type classification exist, but real renderers for XLSX/PDF/video/audio/3D/CAD/G-code and sandboxed HTML content are not integrated.
- CAPY-436: no in-app browser or machine Desktop stream integration exists.
- CAPY-440/441: responsive/PWA shell and phone push are not implemented app-wide.
- CAPY-442: Markdown-twin URL/content-negotiation helpers exist, but there is no docs site serving them.
- CAPY-504: word-level rendered diff exists, but Word document page rendering does not.
- CAPY-505: waveform level calculation exists, but multi-track audio playback/levels UI is not integrated.
- CAPY-507: pinned-note validation exists, but there is no 3D renderer surface to anchor notes.
- CAPY-511: local theme persistence exists, but cross-device sync requires server-side user appearance settings outside this unit scope.

Unverified: no browser end-to-end test; this is a typed fixture-backed web slice only.
