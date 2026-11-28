GOAL
Unblock CAPY-116, CAPY-121, CAPY-122, CAPY-124, CAPY-127: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-31-pr-advanced
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-08
SCOPE: apps/server/src/pr-advanced, apps/web/src/features/pr-advanced, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-31.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-116`: Force merge using your GitHub bypass permission. Test proves: Force merge calls the fixture gateway merge with the user identity and bypass flag; it is offered only when the fixture reports bypass permission.
- `CAPY-121`: Stacked PRs (GitHub native stacks or base-branch stacks), stack chip 2/3, merge from bottom. Test proves: stacked PRs are detected from base-branch chains on the fixture gateway; the chip shows `2/3`; merge is allowed only from the bottom of the stack.
- `CAPY-122`: Fork PRs: check out and review; push own branch instead. Test proves: a fork PR is checked out for review from the fork remote (fixture); pushing goes to an own branch, never the fork.
- `CAPY-124`: Labels row to edit GitHub labels; Preview chip reads Vercel, Cloudflare and other deploy comments. Test proves: a labels row adds and removes labels on the fixture gateway; the Preview chip reads Vercel, Cloudflare and other deploy comments.
- `CAPY-127`: Local PRs on desktop: Diff tab, mark ready/draft, close, reopen, merge. Test proves: a local PR (paired fake device, no GitHub) shows a Diff tab and supports mark ready / draft, close, reopen and merge on the local repo.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-116, CAPY-121, CAPY-122, CAPY-124, CAPY-127
