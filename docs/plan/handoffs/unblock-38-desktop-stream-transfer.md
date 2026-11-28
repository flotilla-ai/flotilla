GOAL
Unblock CAPY-200, CAPY-215, CAPY-216, CAPY-436: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-38-desktop-stream-transfer
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-37
SCOPE: apps/server/src/machine-desktop, apps/web/src/features/machine-desktop, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-38.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-200`: XFCE desktop with Chrome streamed to thread pane. Test proves: a pool machine with the desktop option runs a desktop server (license-checked; unmodified external binary) and the thread pane connects through an authenticated websocket proxy.
- `CAPY-215`: Shell/desktop via + menu, no SSH. Test proves: the + menu Desktop action returns a stream URL instead of 409 when the desktop server is running; Shell is unchanged; no SSH port is published.
- `CAPY-216`: Machines don't share filesystems; ask to transfer files. Test proves: machines share no filesystem; a transfer tool copies a file from one thread machine to another through the server and the receiving thread sees it.
- `CAPY-436`: In-app browser (Cmd/Ctrl+Shift+L) and machine Desktop tab. Test proves: an in-app browser tab (Ctrl+Shift+L) and a machine Desktop tab open in the thread view.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-200, CAPY-215, CAPY-216, CAPY-436
