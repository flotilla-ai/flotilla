GOAL
Unblock CAPY-046, CAPY-171, CAPY-172, CAPY-175: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-13-machine-jobs
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/machine-jobs, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-13.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-046`: Long-running background command with explicit timeout (default 30 min, max 6 h) keeps machine awake while waited on. Test proves: a background job runs through the machine executor on a pool machine (docker or mocked dockerode); while it is waited on the idle-stop skips the machine (`keepAwake`), and after exit or timeout the machine may sleep.
- `CAPY-171`: Automation Drive scope (state between runs). Test proves: an automation with `drive_scope` gets its automation Drive copied in before the run and state written in run 1 is readable in run 2.
- `CAPY-172`: Per-run machine size. Test proves: an automation with `machine_size` creates its machine with that RAM size; an invalid size is rejected.
- `CAPY-175`: Failed run kept with full thread and output. Test proves: a failed automation run keeps its thread and writes final output and error to `automation_runs.output`.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-046, CAPY-171, CAPY-172, CAPY-175
