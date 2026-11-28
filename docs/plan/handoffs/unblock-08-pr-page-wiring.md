GOAL
Unblock CAPY-111, CAPY-112, CAPY-113, CAPY-114, CAPY-126: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-08-pr-page-wiring
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/pr-page, apps/web/src/features/pr-page, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-08.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-111`: Open PRs as Ready or Draft (org default + personal override, per-PR by asking). Test proves: a per-PR draft choice set through the agent tool/API overrides the personal and org default when the PR is created on the fixture gateway.
- `CAPY-112`: 'Open in Capy' button in PR description (toggle). Test proves: with the preference on, PR creation appends an Open in Flotilla link to the description; with it off the description has no link.
- `CAPY-113`: Capy PR page at capy.ai/pull/<owner>/<repo>/<n>; Cmd+K by URL/owner/repo#n/title. Test proves: `/pull/<owner>/<repo>/<n>` renders the PR page; Cmd+K resolves a GitHub URL, `owner/repo#n` and a title to that route.
- `CAPY-114`: Chat with Capy / New thread with PR from the PR page. Test proves: Chat / New thread with PR creates a thread whose first prompt context contains the PR number, title, head branch and URL.
- `CAPY-126`: PR status on idle sidebar rows (Checks / PR failing / PR ready). Test proves: an idle thread row in the sidebar shows Checks / PR failing / PR ready text from pull data.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-111, CAPY-112, CAPY-113, CAPY-114, CAPY-126
