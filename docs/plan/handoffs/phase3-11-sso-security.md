GOAL
Implement the smallest fixture-backed Flotilla foundation for sso, domain verification and two-step security, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-11-sso-security
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/sso-security, apps/web/src/features/sso-security, docs/runlog/phase3-11.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/11-sso-security*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-368`: SSO: Google Workspace OAuth/SAML, Okta, Entra ID, JumpCloud, OneLogin, Keycloak, Auth0, any SAML 2.0 (and OIDC per security page) — Flotilla equivalent: Auth: local accounts + OIDC SSO; self-host: OIDC/SAML via library
- `CAPY-369`: Domain verification by DNS — Flotilla equivalent: Auth: local accounts + OIDC SSO
- `CAPY-370`: Require SSO; passkeys after SSO; manage/switch provider — Flotilla equivalent: Auth: local accounts + OIDC SSO
- `CAPY-371`: Two-step sign-in: authenticator app, passkey, recovery codes; on desktop — Flotilla equivalent: Auth: local accounts + OIDC SSO
- `CAPY-372`: Org two-step levels incl. Passkeys only — Flotilla equivalent: Auth: local accounts + OIDC SSO
- `CAPY-514`: Name/rename passkeys; Security page shows sign-in method; multiple account emails, change primary — Flotilla equivalent: Auth: local accounts + OIDC SSO
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-368, CAPY-369, CAPY-370, CAPY-371, CAPY-372, CAPY-514
