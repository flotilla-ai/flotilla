GOAL
Unblock CAPY-435, CAPY-504, CAPY-505, CAPY-507: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-21-viewers
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/web/src/features/viewers, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-21.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-435`: File viewer: Markdown+Mermaid, CSV/XLSX sortable tables, sandboxed HTML, images, PDF, video/audio, 3D/CAD/G-code; Source toggle; 2 MB text cap. Test proves: the file viewer renders an XLSX fixture as a sortable table, a PDF fixture as pages, video and audio with native players, and an STL / G-code fixture in a 3D canvas; Source toggle and the 2 MB text cap hold.
- `CAPY-504`: Word documents render as pages; Markdown rendered diff with word-level changes. Test proves: a `.docx` fixture renders as pages; a Markdown diff shows word-level insertions and deletions in the rendered view.
- `CAPY-505`: Audio mode with per-track waveforms and Levels. Test proves: audio mode shows one waveform per track for a multi-track fixture with a Levels control per track.
- `CAPY-507`: Annotate 3D models with pinned notes. Test proves: clicking a 3D model adds a pinned note at that point; the note persists and is listed after reload.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-435, CAPY-504, CAPY-505, CAPY-507
