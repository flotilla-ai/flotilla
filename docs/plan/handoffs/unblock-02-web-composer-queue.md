GOAL
Unblock CAPY-009, CAPY-010, CAPY-026, CAPY-467, CAPY-468: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-02-web-composer-queue
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/web/src/features/composer-queue, apps/web/e2e/composer-queue.spec.ts, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-02.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-009`: Edit a queued/steered message before the agent reads it; send now / discard / return to composer. Test proves: a queued message row shows Edit, Send now, Discard and Return to composer; Edit calls PATCH `/threads/:id/inbox/:item`, Discard calls DELETE, and a 409 (already read) removes the controls.
- `CAPY-010`: Edit a sent message; thread continues from new version with a version switcher. Test proves: a sent message has Edit; saving calls POST `/threads/:id/inbox/:item/versions` and a `1/2` version switcher shows either version text.
- `CAPY-026`: Context meter + 'Compact at' per thread, org default. Test proves: the composer shows a context meter from GET `/threads/:id/context` (used/limit) and a Compact-at input that PATCHes; the input is disabled when the adapter lacks `compaction`.
- `CAPY-467`: Send while a file is still uploading; goes out after upload, survives reload. Test proves: sending while an attachment is uploading shows the message as `waiting for upload`; it is still listed after a reload and leaves that state once the upload completes.
- `CAPY-468`: Two or more queued messages fold behind a count above composer. Test proves: with 2 or more queued messages the list folds behind a `N queued` count above the composer; with 1 it does not fold.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-009, CAPY-010, CAPY-026, CAPY-467, CAPY-468
