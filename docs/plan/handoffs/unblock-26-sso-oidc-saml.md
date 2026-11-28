GOAL
Unblock CAPY-368, CAPY-369, CAPY-370: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-26-sso-oidc-saml
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/sso, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-26.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-368`: SSO: Google Workspace OAuth/SAML, Okta, Entra ID, JumpCloud, OneLogin, Keycloak, Auth0, any SAML 2.0 (and OIDC per security page). Test proves: OIDC sign-in completes against a local test IdP (code flow with PKCE, id_token verified by JWKS); a SAML 2.0 signed response from a local test IdP signs in; a bad signature is refused.
- `CAPY-369`: Domain verification by DNS. Test proves: domain verification issues a TXT challenge and verifies it through an injectable DNS resolver (fake DNS); a wrong value fails.
- `CAPY-370`: Require SSO; passkeys after SSO; manage/switch provider. Test proves: with Require SSO on, password login is refused for that domain; passkeys can be added after SSO; an admin switches the provider.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-368, CAPY-369, CAPY-370
