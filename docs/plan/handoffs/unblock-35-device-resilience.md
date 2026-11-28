GOAL
Unblock CAPY-234, CAPY-235, CAPY-236, CAPY-240, CAPY-245: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-35-device-resilience
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-34
SCOPE: apps/runner, apps/server/src/device-resilience, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-35.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-234`: Local thread waits while device asleep/offline up to 24 h. Test proves: a queued run for an offline device waits; reconnect within 24 h starts it; after 24 h (fake clock) it fails with a clear reason.
- `CAPY-235`: Cloud checkpoints of uncommitted local work (on by default, can turn off). Test proves: with checkpoints on, uncommitted device work is uploaded as a checkpoint bundle after a run; with the setting off none is uploaded.
- `CAPY-236`: Automatic move to cloud when offline device blocks work (toggle). Test proves: with move-to-cloud on, a device offline past the threshold moves the thread to a pool machine restored from the last checkpoint.
- `CAPY-240`: Keep awake while agents are running (device setting; Mac lid closed, on power). Test proves: the keep-awake setting makes the runner hold an OS inhibitor (systemd-inhibit / caffeinate argv through an injectable spawner) only while agents run.
- `CAPY-245`: Import local Claude Code and Codex histories as threads. Test proves: importing local Claude Code and Codex history fixtures creates threads with their messages; nothing leaves the device unless requested.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-234, CAPY-235, CAPY-236, CAPY-240, CAPY-245
