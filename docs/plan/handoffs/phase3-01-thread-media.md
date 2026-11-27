GOAL
Implement the smallest fixture-backed Flotilla foundation for thread media and annotations, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-01-thread-media
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/web/src/features/thread-media, apps/server/src/thread-media, docs/runlog/phase3-01.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/01-thread-media*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-028`: Charts, diagrams and small interactive visuals rendered inline in the thread — Flotilla equivalent: Thread + event log + web UI
- `CAPY-029`: Mermaid diagrams rendered in chat (and posted to Slack as images) — Flotilla equivalent: Thread + event log + web UI
- `CAPY-030`: Comments/annotations on images and videos (pin a spot, box an area) — Flotilla equivalent: Thread + event log + web UI
- `CAPY-031`: Video/audio understanding on Gemini models — Flotilla equivalent: Thread + event log + web UI; [ADP] model-capability flag per adapter
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-028, CAPY-029, CAPY-030, CAPY-031
