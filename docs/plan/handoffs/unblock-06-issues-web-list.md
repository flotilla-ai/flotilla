GOAL
Unblock CAPY-101, CAPY-102, CAPY-103, CAPY-107: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-06-issues-web-list
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/web/src/features/issues, apps/server/src/issues-web, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-06.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-101`: Built-in issue tracker: For you / Assigned / Mentioned views, filters (status, assignee, labels, due date, relations…). Test proves: `#/issues` has For you / Assigned / Mentioned views and filters by status, assignee, label, due date and relation; each filter changes the listed set.
- `CAPY-102`: Issue relations (blocks, relates), sub-issues, labels, due date, linked PRs/threads. Test proves: issue detail edits relations (blocks, relates), sub-issues, labels, due date and shows linked PRs and threads.
- `CAPY-103`: Threads file, update and close issues; owning thread wakes on comments. Test proves: agent issue tools file, update and close an issue from a thread; a new comment on the issue wakes the owning thread.
- `CAPY-107`: Issue comments, timeline, file downloads. Test proves: issue detail shows comments and a timeline of changes, and downloads an attached file.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-101, CAPY-102, CAPY-103, CAPY-107
