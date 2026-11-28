GOAL
Unblock CAPY-063, CAPY-064, CAPY-065: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-16-forks-side-chat
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/forks, apps/web/src/features/forks, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-16.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-063`: Side chat: full copy on same machine, opens as a tab, sees uncommitted changes (/side, Cmd+Shift+S). Test proves: `/side` creates a side chat on the same machine with a workspace copy that contains an uncommitted file and the copied fake session; it opens as a tab.
- `CAPY-064`: Fork: full copy (/fork) or summary (/fork-summary) on a fresh machine; 'Fork of …'. Test proves: `/fork` creates a full copy on a fresh machine titled `Fork of <title>`; `/fork-summary` creates a new thread whose first prompt is a summary instead of the session.
- `CAPY-065`: Select text to fork or side-chat from that passage. Test proves: selecting a passage offers Fork and Side chat; the new thread first prompt quotes the passage.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-063, CAPY-064, CAPY-065
