GOAL
Unblock CAPY-261, CAPY-262, CAPY-263, CAPY-264, CAPY-271: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-45-phones-provider
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/phones, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-45.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-261`: Attach iOS/Android cloud phones to a thread (Revyl); screen only. Test proves: a thread attaches an iOS or Android cloud phone through a provider interface (fake provider); the attachment is screen only.
- `CAPY-262`: Revyl auto-connects on first use; admin approval if user already has Revyl. Test proves: the provider auto-connects on first use; when the user already has a provider account an admin approval is required first.
- `CAPY-263`: Admins disconnect / toggle Mobile builds and devices. Test proves: admins disconnect the provider and toggle Mobile builds and devices; an off toggle refuses new sessions.
- `CAPY-264`: Device models (iPhone 18 Pro Max…iPad Pro, Pixel 7). Test proves: the device model list comes from the provider; an unknown model is rejected.
- `CAPY-271`: Phone pricing iPhone $5.40/h, Android $3.60/h; Pro+. Test proves: phone time is metered per hour at configurable rates by platform and written to the cost ledger.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-261, CAPY-262, CAPY-263, CAPY-264, CAPY-271
