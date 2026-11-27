GOAL
Implement the smallest fixture-backed Flotilla foundation for cloud credential oidc issuer, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase4-04-cloud-oidc
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/cloud-oidc, apps/web/src/features/cloud-oidc, docs/runlog/phase4-04.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/04-cloud-oidc*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-390`: Capy as OIDC issuer per org; issuer URLs in Settings → Cloud credentials — Flotilla equivalent: Flotilla as OIDC issuer per thread; Flotilla self-host can be its own issuer
- `CAPY-391`: AWS AssumeRoleWithWebIdentity setup + checks — Flotilla equivalent: Flotilla as OIDC issuer per thread
- `CAPY-392`: Azure federated identity credential — Flotilla equivalent: Flotilla as OIDC issuer per thread
- `CAPY-393`: Google Cloud Workload Identity Federation + SA impersonation — Flotilla equivalent: Flotilla as OIDC issuer per thread
- `CAPY-394`: HashiCorp Vault JWT auth — Flotilla equivalent: Flotilla as OIDC issuer per thread
- `CAPY-395`: Generic OIDC for any service — Flotilla equivalent: Flotilla as OIDC issuer per thread
- `CAPY-396`: Token claims name org/project/thread; audit logs show thread code — Flotilla equivalent: Flotilla as OIDC issuer per thread
- `CAPY-397`: Tokens/files at /etc/capy/cloud-access/, 1 h lifetime, refresh; remove project to revoke — Flotilla equivalent: Flotilla as OIDC issuer per thread
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-390, CAPY-391, CAPY-392, CAPY-393, CAPY-394, CAPY-395, CAPY-396, CAPY-397
