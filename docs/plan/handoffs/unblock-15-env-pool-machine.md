GOAL
Unblock CAPY-183, CAPY-184, CAPY-185, CAPY-187, CAPY-188, CAPY-212: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-15-env-pool-machine
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/env-pool, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-15.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-183`: Dev environment per repo: scripts, startup entries, commands, snapshots; versioned shared history. Test proves: an environment version with a snapshot step builds a snapshot recorded in shared history and the next pool boot uses it.
- `CAPY-184`: 'Ask Capy to set up' (capy-setup skill) writes and verifies setup on its own machine. Test proves: an Ask to set up action starts a thread with the setup skill; it writes a spec and `environment.verify` records the verdict on the version.
- `CAPY-185`: initialize phase (fresh clone; 900 s default) and refresh phase (checkout moved; 300 s); timeouts 60–3600 s. Test proves: on a pool-booted machine a fresh clone runs initialize (900 s default) and a moved checkout runs refresh (300 s); a timeout outside 60-3600 s is rejected.
- `CAPY-187`: Scripts run in bash from repo dir as sudo user with env vars. Test proves: setup scripts on a pool-booted machine run in bash from the repo dir with thread env; `FLOTILLA_SUDO` is set only when the machine caps allow sudo.
- `CAPY-188`: Commands: named on-demand actions (test, build, db reset). Test proves: a named command (`test`) runs on a pool-booted machine and its state and exit code are recorded.
- `CAPY-212`: 14-day sleeping machine deletion; rebuild from dev environment if resume fails. Test proves: production `beforeDelete` commits and pushes WIP to a `flotilla/wip/<thread>` branch on a fixture remote; only then is the 14-day sleeping workspace deleted; a failed wake rebuilds from the environment.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-183, CAPY-184, CAPY-185, CAPY-187, CAPY-188, CAPY-212
