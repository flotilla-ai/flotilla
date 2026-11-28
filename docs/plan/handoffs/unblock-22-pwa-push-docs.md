GOAL
Unblock CAPY-440, CAPY-441, CAPY-442, CAPY-449, CAPY-511: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-22-pwa-push-docs
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/push, apps/server/src/docs-site, apps/web/public, apps/web/src/features/pwa, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-22.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-440`: Phone browser + Home Screen PWA push. Test proves: the web app serves a manifest and service worker and is installable; a push to a subscription reaches a local mock push service with VAPID headers.
- `CAPY-441`: Native iOS app (TestFlight beta). Test proves: the responsive PWA shell is the stated replacement for the native iOS app: at 390 px width the thread list, thread view and composer are usable with no horizontal scroll.
- `CAPY-442`: Docs site with Markdown twins (.md / ?format=md / Accept header). Test proves: docs pages are served with Markdown twins: `<page>.md`, `?format=md` and `Accept: text/markdown` each return the Markdown source.
- `CAPY-449`: Browser push per device (mentions, failures) even with Capy closed. Test proves: a mention or failure event sends a signed Web Push (VAPID JWT, encrypted payload) per subscribed device to the mock push service without any open browser session.
- `CAPY-511`: Theme follows you across devices; project logo upload. Test proves: the theme setting is stored server-side per user so a second session reads it; a project logo uploads and is served.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-440, CAPY-441, CAPY-442, CAPY-449, CAPY-511
