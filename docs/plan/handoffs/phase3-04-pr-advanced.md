GOAL
Implement the smallest fixture-backed Flotilla foundation for advanced pull request workflows, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-04-pr-advanced
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/pr-advanced, apps/web/src/features/pr-advanced, docs/runlog/phase3-04.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/pr-advanced*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-116`: Force merge using your GitHub bypass permission — Flotilla equivalent: GitHub integration + PR ownership + autofix loop
- `CAPY-121`: Stacked PRs (GitHub native stacks or base-branch stacks), stack chip 2/3, merge from bottom — Flotilla equivalent: GitHub integration + PR ownership + autofix loop
- `CAPY-122`: Fork PRs: check out and review; push own branch instead — Flotilla equivalent: GitHub integration + PR ownership + autofix loop
- `CAPY-124`: Labels row to edit GitHub labels; Preview chip reads Vercel, Cloudflare and other deploy comments — Flotilla equivalent: GitHub integration + PR ownership + autofix loop
- `CAPY-127`: Local PRs on desktop: Diff tab, mark ready/draft, close, reopen, merge — Flotilla equivalent: GitHub integration + PR ownership + autofix loop; [BYOM]
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-116, CAPY-121, CAPY-122, CAPY-124, CAPY-127
