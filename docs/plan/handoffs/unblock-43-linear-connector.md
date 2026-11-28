GOAL
Unblock CAPY-416, CAPY-417, CAPY-418, CAPY-419: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-43-linear-connector
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/linear, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-43.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-416`: Linear connection (one workspace per org); personal account link. Test proves: one Linear workspace per org connects through OAuth against a local Linear mock; a second workspace is refused; a personal account link is stored.
- `CAPY-417`: Delegate issue → native agent session 1:1 with a thread. Test proves: delegating an issue (signed webhook) creates a native agent session mapped 1:1 to a thread; a second delegation of the same issue reuses it.
- `CAPY-418`: Deterministic project routing; team→project map; default project. Test proves: project routing is deterministic: team to project map, then default project; an unmapped team with no default is refused with a clear session message.
- `CAPY-419`: Per-repo default branches for Linear-origin threads. Test proves: a Linear-origin thread uses the per-repo default branch configured for Linear.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-416, CAPY-417, CAPY-418, CAPY-419
