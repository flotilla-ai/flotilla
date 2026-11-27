GOAL
Implement the smallest fixture-backed Flotilla foundation for navigation, layout and onboarding, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-14-ui-navigation
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/web/src/features/ui-navigation, docs/runlog/phase3-14.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/14-ui-navigation*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-427`: Sidebar: Captains, Pinned, folders, Threads by project; Hybrid layout; group by project/folder/none — Flotilla equivalent: Web UI
- `CAPY-428`: Bottom bar: Threads, Issues, Pull requests, Automations, Explore, Drive (reorder/hide) — Flotilla equivalent: Web UI
- `CAPY-429`: Folders (private/shared, no nesting), Pinned, tags (≤20/thread) — Flotilla equivalent: Web UI
- `CAPY-430`: Threads page with filters and saved views — Flotilla equivalent: Web UI
- `CAPY-431`: Cmd+K command menu across threads, PRs, automations, settings; category pills & filters — Flotilla equivalent: Web UI
- `CAPY-432`: Thread pane: Overview, Diffs, Files, Setup, Browser, Desktop, Shell, PRs, subagents, phones tabs — Flotilla equivalent: Web UI
- `CAPY-433`: Tab menu: close others/right/all, reopen closed, middle-click close — Flotilla equivalent: Web UI
- `CAPY-434`: Split panes (split right/down) — Flotilla equivalent: Web UI
- `CAPY-508`: Pages at top setting; collapsible sidebar sections; Customize sidebar — Flotilla equivalent: Web UI
- `CAPY-509`: Preview tabs (close when you move on, double-click to keep) — Flotilla equivalent: Web UI
- `CAPY-512`: Onboarding steps that survive reload; joiners skip org setup — Flotilla equivalent: Web UI
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-427, CAPY-428, CAPY-429, CAPY-430, CAPY-431, CAPY-432, CAPY-433, CAPY-434, CAPY-508, CAPY-509, CAPY-512
