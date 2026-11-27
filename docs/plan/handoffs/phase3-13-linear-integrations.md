GOAL
Implement the smallest fixture-backed Flotilla foundation for linear and other integrations, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-13-linear-integrations
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/linear-integration, apps/server/src/other-integrations, apps/web/src/features/integrations, docs/runlog/phase3-13.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/linear-integrations*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-416`: Linear connection (one workspace per org); personal account link — Flotilla equivalent: Linear agent session integration
- `CAPY-417`: Delegate issue → native agent session 1:1 with a thread — Flotilla equivalent: Linear agent session integration
- `CAPY-418`: Deterministic project routing; team→project map; default project — Flotilla equivalent: Linear agent session integration
- `CAPY-419`: Per-repo default branches for Linear-origin threads — Flotilla equivalent: Linear agent session integration
- `CAPY-420`: Posts progress, plan, responses, thread link into the session — Flotilla equivalent: Linear agent session integration
- `CAPY-421`: Linear stop signal interrupts the run — Flotilla equivalent: Linear agent session integration
- `CAPY-422`: Vercel preview detection with best-URL ordering — Flotilla equivalent: Integrations (Vercel/Paper/etc.)
- `CAPY-424`: Paper design files read/edit in threads — Flotilla equivalent: Integrations (Vercel/Paper/etc.)
- `CAPY-425`: Marketplace plugins named publicly: ClickStack, Supermemory, Keiki — Flotilla equivalent: Integrations (Vercel/Paper/etc.); full marketplace list not public
- `CAPY-426`: Web search/retrieval (Firecrawl, Exa) — Flotilla equivalent: Integrations (Vercel/Paper/etc.); [ADP] agent's own web tools
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-416, CAPY-417, CAPY-418, CAPY-419, CAPY-420, CAPY-421, CAPY-422, CAPY-424, CAPY-425, CAPY-426
