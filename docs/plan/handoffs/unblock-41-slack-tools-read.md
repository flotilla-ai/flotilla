GOAL
Unblock CAPY-029, CAPY-412, CAPY-414, CAPY-516: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-41-slack-tools-read
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-39
SCOPE: apps/server/src/slack-tools, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-41.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-029`: Mermaid diagrams rendered in chat (and posted to Slack as images). Test proves: a Mermaid block in an agent reply is rendered to an image and uploaded to the Slack thread on the mock (`files.upload` flow).
- `CAPY-412`: Personal Slack link; Read Slack as you (read-only). Test proves: a personal Slack link stores a user token reference; Read Slack as you calls only read methods and any write with the user token is refused.
- `CAPY-414`: Agent Slack tools: read, send (with files), react, list channels, DM you, wait for reactions, edit/delete own messages. Test proves: agent Slack tools read, send (with files), react, list channels, DM you, wait for reactions, edit and delete own messages each call the mock; editing another user message is refused.
- `CAPY-516`: Read Slack as you can read a DM/private channel after per-thread allow. Test proves: reading a DM or private channel as the user is refused until the per-thread allow is granted, then succeeds.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-029, CAPY-412, CAPY-414, CAPY-516
