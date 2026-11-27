GOAL
Implement the smallest fixture-backed Flotilla foundation for built-in issues core, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-03-issues-core
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/issues, apps/web/src/features/issues, docs/runlog/phase3-03.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/issues-core*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-101`: Built-in issue tracker: For you / Assigned / Mentioned views, filters (status, assignee, labels, due date, relations…) — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-102`: Issue relations (blocks, relates), sub-issues, labels, due date, linked PRs/threads — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-103`: Threads file, update and close issues; owning thread wakes on comments — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-104`: Issues board (columns per status, drag, bulk move, undo, keyboard) — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-105`: Saved issue views; editable title; reply to/edit comments in place — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-106`: Custom issue states (create/order/default), labels, issue prefix — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-107`: Issue comments, timeline, file downloads — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-496`: Display menu groups/orders issues, hides row properties; comments tag skills/PRs/files — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
- `CAPY-497`: Click status icon to change status; Capy issue links unfurl in Slack — Flotilla equivalent: Built-in issues (Postgres) or GitHub/Linear issues
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-101, CAPY-102, CAPY-103, CAPY-104, CAPY-105, CAPY-106, CAPY-107, CAPY-496, CAPY-497
