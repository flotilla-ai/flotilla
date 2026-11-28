GOAL
Unblock CAPY-390, CAPY-395, CAPY-396, CAPY-397: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-28-oidc-issuer
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/cloud-oidc, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-28.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-390`: Capy as OIDC issuer per org; issuer URLs in Settings → Cloud credentials. Test proves: each org has an issuer URL serving `/.well-known/openid-configuration` and JWKS; Settings → Cloud credentials shows the issuer URL.
- `CAPY-395`: Generic OIDC for any service. Test proves: a generic OIDC token for a configured audience verifies against the JWKS with a standard JWT library.
- `CAPY-396`: Token claims name org/project/thread; audit logs show thread code. Test proves: token claims carry org, project and thread code; each issuance writes an audit entry with the thread code.
- `CAPY-397`: Tokens/files at /etc/capy/cloud-access/, 1 h lifetime, refresh; remove project to revoke. Test proves: tokens are written to `/etc/flotilla/cloud-access/` in the thread machine with a 1 h lifetime and are refreshed before expiry; removing the project from the credential stops issuance and deletes the file.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-390, CAPY-395, CAPY-396, CAPY-397
