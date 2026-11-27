GOAL
Implement the smallest fixture-backed Flotilla foundation for workspace plans and usage analytics, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-09-billing-usage
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/usage-analytics, apps/web/src/features/usage-analytics, docs/runlog/phase3-09.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/09-billing-usage*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-350`: Workspace type Personal/Team — Flotilla equivalent: P3: Personal vs Team = a single-user install vs an org (CAPY-357+); no billing attached.
- `CAPY-354`: Private work shown to admins as metadata only — Flotilla equivalent: Cost ledger (per-thread CostEntry) + usage page
- `CAPY-355`: Activity page: Capy share of merged PRs, review-found issues, contributed PRs, agent hours — Flotilla equivalent: Cost ledger (per-thread CostEntry) + usage page
- `CAPY-487`: By member table ranks by Cost or Tokens; cached tokens not double-counted — Flotilla equivalent: Cost ledger (per-thread CostEntry) + usage page
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-350, CAPY-354, CAPY-355, CAPY-487
