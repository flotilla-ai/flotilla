GOAL
Unblock CAPY-465, CAPY-466, CAPY-469, CAPY-470, CAPY-476: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-03-web-composer-cards
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/web/src/features/composer-cards, apps/web/e2e/composer-cards.spec.ts, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-03.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-465`: /plan prefix: explore and ask first, change nothing until plan approved (Slack, Linear, API too). Test proves: typing `/plan <text>` sends plan mode; a plan approval card (gate `plan`) renders with Approve, and approving calls the approvals API.
- `CAPY-466`: /btw opens a side thread like /side; hold Alt+M to talk. Test proves: typing `/btw <q>` creates a side thread; a `thread.side` event opens a side panel showing the child thread.
- `CAPY-469`: Retry on provider error with no message to type; error card offers Retry or another model on own key. Test proves: a `run.ended` error renders an error card with Retry and a model select; Retry POSTs `/threads/:id/retry` with the chosen model and no message text.
- `CAPY-470`: Request cards: Later / Dismiss, synced across devices; Captain gathers crew questions with Dismiss all. Test proves: request cards have Later and Dismiss calling `/approvals/:id/later|dismiss`; an `approval.updated` event removes the card; a Captain view has Dismiss all calling `/captains/:id/approvals/dismiss`.
- `CAPY-476`: Codemode: agent writes programs that call tools; inner tool calls shown live. Test proves: tool calls with `parentId` render nested under their parent tool call and update live from `agent.tool_*` events.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-465, CAPY-466, CAPY-469, CAPY-470, CAPY-476
