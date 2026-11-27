GOAL
Implement the smallest fixture-backed Flotilla foundation for public folders, files, attachments and users api, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-17-api-folders-files
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/api-folders-files, docs/runlog/phase3-17.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/api-folders-files*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-562`: List — Flotilla equivalent: Public REST + SSE API
- `CAPY-563`: Threads — Flotilla equivalent: Public REST + SSE API
- `CAPY-564`: File — Flotilla equivalent: Public REST + SSE API
- `CAPY-565`: Unfile — Flotilla equivalent: Public REST + SSE API
- `CAPY-566`: Pin — Flotilla equivalent: Public REST + SSE API
- `CAPY-567`: Unpin — Flotilla equivalent: Public REST + SSE API
- `CAPY-605`: Upload files — Flotilla equivalent: Public REST + SSE API
- `CAPY-606`: List — Flotilla equivalent: Public REST + SSE API
- `CAPY-607`: Download — Flotilla equivalent: Public REST + SSE API
- `CAPY-638`: List organization users — Flotilla equivalent: Public REST + SSE API
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-562, CAPY-563, CAPY-564, CAPY-565, CAPY-566, CAPY-567, CAPY-605, CAPY-606, CAPY-607, CAPY-638
