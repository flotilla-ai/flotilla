GOAL
Implement the smallest fixture-backed Flotilla foundation for public review rules and filters api, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-20-api-review-rules
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/api-review-rules, docs/runlog/phase3-20.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/20-api-review-rules*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-622`: Get review rule — Flotilla equivalent: Public REST + SSE API
- `CAPY-623`: Delete review rule — Flotilla equivalent: Public REST + SSE API
- `CAPY-624`: Update review rule — Flotilla equivalent: Public REST + SSE API
- `CAPY-625`: List review rules — Flotilla equivalent: Public REST + SSE API
- `CAPY-626`: Create review rule — Flotilla equivalent: Public REST + SSE API
- `CAPY-627`: List rules — Flotilla equivalent: Public REST + SSE API
- `CAPY-628`: Create rule — Flotilla equivalent: Public REST + SSE API
- `CAPY-629`: Delete rule — Flotilla equivalent: Public REST + SSE API
- `CAPY-630`: Update rule — Flotilla equivalent: Public REST + SSE API
- `CAPY-631`: List ignore paths — Flotilla equivalent: Public REST + SSE API
- `CAPY-632`: Create ignore paths — Flotilla equivalent: Public REST + SSE API
- `CAPY-633`: Delete ignore paths — Flotilla equivalent: Public REST + SSE API
- `CAPY-634`: Update ignore paths — Flotilla equivalent: Public REST + SSE API
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-622, CAPY-623, CAPY-624, CAPY-625, CAPY-626, CAPY-627, CAPY-628, CAPY-629, CAPY-630, CAPY-631, CAPY-632, CAPY-633, CAPY-634
