GOAL
Unblock CAPY-391, CAPY-392, CAPY-393, CAPY-394: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-29-cloud-federation
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-28
SCOPE: apps/server/src/cloud-federation, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-29.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-391`: AWS AssumeRoleWithWebIdentity setup + checks. Test proves: AWS setup writes `AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN`; a fake STS `AssumeRoleWithWebIdentity` accepts the Flotilla token; setup checks report a wrong audience.
- `CAPY-392`: Azure federated identity credential. Test proves: Azure federated credential config (issuer, subject, audience) is generated and a fake Entra token endpoint exchanges the token.
- `CAPY-393`: Google Cloud Workload Identity Federation + SA impersonation. Test proves: a Google credential config file (workload identity pool plus service account impersonation) is generated and a fake STS and IAM exchange succeeds.
- `CAPY-394`: HashiCorp Vault JWT auth. Test proves: a fake Vault JWT auth endpoint logs in with the token and role; a revoked credential is refused.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-391, CAPY-392, CAPY-393, CAPY-394
