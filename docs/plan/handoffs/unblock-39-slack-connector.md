GOAL
Unblock CAPY-406, CAPY-407, CAPY-409, CAPY-415, CAPY-515: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-39-slack-connector
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/slack, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-39.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-406`: Install Slack app from Capy settings; org-wide; default project for DMs/channels. Test proves: the Slack app installs org-wide through OAuth against a local Slack API mock; a default project for DMs and channels is stored.
- `CAPY-407`: @Capy starts/continues a thread and replies in the Slack thread. Test proves: a signed `app_mention` event starts a thread and the reply is posted in the Slack thread (mock `chat.postMessage` with `thread_ts`); a second mention continues the same thread; a bad signature gets 401.
- `CAPY-409`: Channel → project mappings. Test proves: a channel to project mapping routes a mention in that channel to the mapped project.
- `CAPY-415`: Aside prefix setting. Test proves: the aside prefix setting changes which prefix marks a message as an aside (not sent to the agent).
- `CAPY-515`: Admins can turn off Link to Capy thread and Post confirmations. Test proves: admins turn off Link to thread and Post confirmations; the mock then receives no link and no confirmation post.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-406, CAPY-407, CAPY-409, CAPY-415, CAPY-515
