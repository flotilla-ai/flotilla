GOAL
Unblock CAPY-156, CAPY-157, CAPY-158, CAPY-174: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-47-automation-vendor-triggers
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-39, unblock-43
SCOPE: apps/server/src/automation-triggers, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-47.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-156`: Slack trigger: channel messages grouped into bursts (window 1–300 s, 20 msgs, 100 KB). Test proves: Slack channel messages are grouped into bursts (window 1-300 s, 20 messages, 100 KB) and each burst triggers one run.
- `CAPY-157`: Slack reaction trigger. Test proves: a Slack reaction event triggers the automation.
- `CAPY-158`: Linear triggers: issue created, status changed, cycle ended; team/label filters. Test proves: Linear issue created, status changed and cycle ended events trigger with team and label filters.
- `CAPY-174`: Quiet Slack posts; Matching pattern for Slack/webhook triggers; editable description. Test proves: quiet posts make the automation post without notification on the mock; a Matching pattern filters Slack and webhook triggers; the description is editable.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-156, CAPY-157, CAPY-158, CAPY-174
