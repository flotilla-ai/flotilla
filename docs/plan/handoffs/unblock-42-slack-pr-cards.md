GOAL
Unblock CAPY-413, CAPY-452, CAPY-517: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-42-slack-pr-cards
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-39
SCOPE: apps/server/src/slack-pr, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-42.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-413`: PR cards kept live from GitHub; merge from card turns on auto-merge. Test proves: a PR card posted to Slack is updated (`chat.update`) on GitHub fixture events; Merge on the card turns on auto-merge on the fixture gateway.
- `CAPY-452`: Slack DM from Capy; PR merge/close follow-up sentence. Test proves: Flotilla sends a Slack DM on the mock, and a PR merge or close adds the follow-up sentence.
- `CAPY-517`: Slack DM when a thread's PR merges. Test proves: when a thread PR merges, the thread owner gets a Slack DM on the mock.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-413, CAPY-452, CAPY-517
