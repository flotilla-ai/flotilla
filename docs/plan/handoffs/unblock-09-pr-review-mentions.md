GOAL
Unblock CAPY-134, CAPY-401, CAPY-403: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-09-pr-review-mentions
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-08
SCOPE: apps/server/src/pr-mentions, apps/web/src/features/pr-page, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-09.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-134`: Start review from PR page, '@capy review <instructions>', or API. Test proves: a Review button on the PR page starts a review (source `page`); a `@flotilla review <instructions>` PR comment starts one (source `mention`) carrying the instructions.
- `CAPY-401`: Commit author options (You+Capy co-author default, You, Capy+you, Capy); per-PR override; API pullRequestAuthor. Test proves: each of the four commit author options produces the expected author and `Co-authored-by` trailer on a commit made in a fixture repo; the per-PR override wins; API `pullRequestAuthor` is accepted.
- `CAPY-403`: @capy <message> / @capy review on PRs; 👀 reaction. Test proves: a PR comment `@flotilla <message>` (and the `@capy` alias) wakes the PR thread with the message and the fixture gateway records an eyes reaction on that comment.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-134, CAPY-401, CAPY-403
