GOAL
Implement the smallest fixture-backed Flotilla foundation for public issues api, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-18-api-issues
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/api-issues, docs/runlog/phase3-18.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/18-api-issues*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-568`: List issues — Flotilla equivalent: Public REST + SSE API
- `CAPY-569`: Create issue — Flotilla equivalent: Public REST + SSE API
- `CAPY-570`: Get issue — Flotilla equivalent: Public REST + SSE API
- `CAPY-571`: Update issue — Flotilla equivalent: Public REST + SSE API
- `CAPY-572`: List issue comments — Flotilla equivalent: Public REST + SSE API
- `CAPY-573`: Comment on issue — Flotilla equivalent: Public REST + SSE API
- `CAPY-574`: List issue timeline — Flotilla equivalent: Public REST + SSE API
- `CAPY-575`: List issue relations — Flotilla equivalent: Public REST + SSE API
- `CAPY-576`: Relate issues — Flotilla equivalent: Public REST + SSE API
- `CAPY-577`: Remove issue relation — Flotilla equivalent: Public REST + SSE API
- `CAPY-578`: Link pull request or thread — Flotilla equivalent: Public REST + SSE API
- `CAPY-579`: Unlink pull request or thread — Flotilla equivalent: Public REST + SSE API
- `CAPY-580`: Download issue file — Flotilla equivalent: Public REST + SSE API
- `CAPY-581`: List issue states — Flotilla equivalent: Public REST + SSE API
- `CAPY-582`: Create issue state — Flotilla equivalent: Public REST + SSE API
- `CAPY-583`: Reorder issue states — Flotilla equivalent: Public REST + SSE API
- `CAPY-584`: Delete issue state — Flotilla equivalent: Public REST + SSE API
- `CAPY-585`: Update issue state — Flotilla equivalent: Public REST + SSE API
- `CAPY-586`: Set default issue state — Flotilla equivalent: Public REST + SSE API
- `CAPY-587`: List issue labels — Flotilla equivalent: Public REST + SSE API
- `CAPY-588`: Create issue label — Flotilla equivalent: Public REST + SSE API
- `CAPY-589`: Delete issue label — Flotilla equivalent: Public REST + SSE API
- `CAPY-590`: Update issue label — Flotilla equivalent: Public REST + SSE API
- `CAPY-591`: Get issue prefix — Flotilla equivalent: Public REST + SSE API
- `CAPY-592`: Set issue prefix — Flotilla equivalent: Public REST + SSE API
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-568, CAPY-569, CAPY-570, CAPY-571, CAPY-572, CAPY-573, CAPY-574, CAPY-575, CAPY-576, CAPY-577, CAPY-578, CAPY-579, CAPY-580, CAPY-581, CAPY-582, CAPY-583, CAPY-584, CAPY-585, CAPY-586, CAPY-587, CAPY-588, CAPY-589, CAPY-590, CAPY-591, CAPY-592
