GOAL
Implement the smallest fixture-backed Flotilla foundation for file viewers, browser surfaces and explore, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-15-ui-viewers
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/web/src/features/ui-viewers, docs/runlog/phase3-15.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/15-ui-viewers*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-435`: File viewer: Markdown+Mermaid, CSV/XLSX sortable tables, sandboxed HTML, images, PDF, video/audio, 3D/CAD/G-code; Source toggle; 2 MB text cap — Flotilla equivalent: Web UI
- `CAPY-436`: In-app browser (Cmd/Ctrl+Shift+L) and machine Desktop tab — Flotilla equivalent: Web UI
- `CAPY-437`: Appearance: themes (built-in + custom), code font size, scroll-new-messages setting — Flotilla equivalent: Web UI
- `CAPY-438`: Explore (plugins, skills, themes listings) — Flotilla equivalent: Web UI; details not public
- `CAPY-439`: Settings search and settings map — Flotilla equivalent: Web UI
- `CAPY-440`: Phone browser + Home Screen PWA push — Flotilla equivalent: Web UI
- `CAPY-441`: Native iOS app (TestFlight beta) — Flotilla equivalent: P3: replaced. Responsive web UI / PWA; no native iOS app.
- `CAPY-442`: Docs site with Markdown twins (.md / ?format=md / Accept header) — Flotilla equivalent: Web UI
- `CAPY-504`: Word documents render as pages; Markdown rendered diff with word-level changes — Flotilla equivalent: Web UI
- `CAPY-505`: Audio mode with per-track waveforms and Levels — Flotilla equivalent: Web UI
- `CAPY-506`: Terminals: clickable links, find bar, colored exit line — Flotilla equivalent: Web UI
- `CAPY-507`: Annotate 3D models with pinned notes — Flotilla equivalent: Web UI
- `CAPY-510`: Explore: Popular and Recommended for your stack — Flotilla equivalent: Web UI
- `CAPY-511`: Theme follows you across devices; project logo upload — Flotilla equivalent: Web UI
- `CAPY-513`: Generated pages/decks/prototypes as single HTML in Capy design — Flotilla equivalent: Web UI
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-435, CAPY-436, CAPY-437, CAPY-438, CAPY-439, CAPY-440, CAPY-441, CAPY-442, CAPY-504, CAPY-505, CAPY-506, CAPY-507, CAPY-510, CAPY-511, CAPY-513
