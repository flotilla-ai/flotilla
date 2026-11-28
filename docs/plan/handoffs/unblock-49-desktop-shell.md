GOAL
Unblock CAPY-227, CAPY-241, CAPY-247, CAPY-248, CAPY-489, CAPY-491: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-49-desktop-shell
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-33
SCOPE: apps/desktop (Electron, MIT), one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-49.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-227`: Desktop app macOS (.dmg, Apple Silicon/Intel), Windows x64, Linux x64/arm64 (.deb, AppImage, .tar.gz); self-updates. Test proves: an Electron shell builds unsigned Linux targets (AppImage, deb, tar.gz) and starts under xvfb; mac / Windows targets and update feed are configured; signing stays for mehdi.
- `CAPY-241`: System tray keeps device online on Windows/Linux. Test proves: on Windows / Linux a tray icon keeps the device runner online after the window closes (tray model tested under xvfb).
- `CAPY-247`: Desktop: tabs, multiple windows, split panes. Test proves: the desktop app opens tabs, a second window and split panes.
- `CAPY-248`: Desktop logs stay local; Export logs on crash screen. Test proves: desktop logs are written locally only and Export logs on the crash screen writes an archive.
- `CAPY-489`: Open files in: choose editor or system default. Test proves: Open files in uses a chosen editor command or the system default (argv built through an injectable opener).
- `CAPY-491`: Dock/taskbar unread mentions count. Test proves: the dock / taskbar badge count equals unread mentions.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-227, CAPY-241, CAPY-247, CAPY-248, CAPY-489, CAPY-491
