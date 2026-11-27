GOAL
Implement the smallest fixture-backed Flotilla foundation for advanced model connections and defaults, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-08-models-connections
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/model-advanced, apps/web/src/features/model-advanced, docs/runlog/phase3-08.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/08-models-connections*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-323`: Azure (organization) models — Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys)
- `CAPY-324`: Fast mode (priority tier) with fallback to standard — Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys)
- `CAPY-326`: Modes: fast, pro, ultrafast, daybreak — Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys); daybreak semantics unverified
- `CAPY-334`: Org settings: members can connect own; members choose run-out; Only <key>; Turn off model; Compact at — Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys)
- `CAPY-482`: Anyone who can see the thread can approve credits; one approval covers a Captain's crew — Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys); [CAP] crew-wide approval semantics worth copying
- `CAPY-483`: Default model for Slack mentions and Linear threads + personal default — Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys)
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-323, CAPY-324, CAPY-326, CAPY-334, CAPY-482, CAPY-483
