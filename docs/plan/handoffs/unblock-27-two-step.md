GOAL
Unblock CAPY-371, CAPY-372, CAPY-514: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-27-two-step
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-26
SCOPE: apps/server/src/two-step, apps/web/src/features/security, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-27.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-371`: Two-step sign-in: authenticator app, passkey, recovery codes; on desktop. Test proves: TOTP enrolment and verification (RFC 6238 vectors), WebAuthn passkey registration and assertion against a software authenticator, and single-use recovery codes each complete the second step.
- `CAPY-372`: Org two-step levels incl. Passkeys only. Test proves: org two-step levels (off, any, passkeys only) are enforced at sign-in: with passkeys only a TOTP-only user is refused.
- `CAPY-514`: Name/rename passkeys; Security page shows sign-in method; multiple account emails, change primary. Test proves: passkeys can be named and renamed; the Security page shows the sign-in method; a user adds a second email, verifies it and makes it primary.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-371, CAPY-372, CAPY-514
