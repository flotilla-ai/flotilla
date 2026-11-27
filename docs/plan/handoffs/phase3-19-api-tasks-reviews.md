GOAL
Implement the smallest fixture-backed Flotilla foundation for public tasks and reviews api, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-19-api-tasks-reviews
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/api-tasks-reviews, docs/runlog/phase3-19.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/19-api-tasks-reviews*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-596`: List tasks — Flotilla equivalent: Public REST + SSE API; legacy alias; skip unless migrating scripts
- `CAPY-597`: Get task — Flotilla equivalent: Public REST + SSE API; legacy alias; skip unless migrating scripts
- `CAPY-598`: List task messages — Flotilla equivalent: Public REST + SSE API; legacy alias; skip unless migrating scripts
- `CAPY-611`: Get review settings — Flotilla equivalent: Public REST + SSE API
- `CAPY-612`: Configure review settings — Flotilla equivalent: Public REST + SSE API
- `CAPY-618`: Start review — Flotilla equivalent: Public REST + SSE API
- `CAPY-619`: Round — Flotilla equivalent: Public REST + SSE API
- `CAPY-620`: Pull — Flotilla equivalent: Public REST + SSE API
- `CAPY-621`: Update finding statuses — Flotilla equivalent: Public REST + SSE API
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-596, CAPY-597, CAPY-598, CAPY-611, CAPY-612, CAPY-618, CAPY-619, CAPY-620, CAPY-621
