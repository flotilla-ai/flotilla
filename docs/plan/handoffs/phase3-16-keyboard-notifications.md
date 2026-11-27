GOAL
Implement the smallest fixture-backed Flotilla foundation for keyboard shortcuts and notifications, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-16-keyboard-notifications
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/web/src/features/keyboard-shortcuts, apps/server/src/notifications, apps/web/src/features/notifications, docs/runlog/phase3-16.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/16-keyboard-notifications*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-443`: Cmd/Ctrl+K command menu; Cmd/Ctrl+Shift+O new thread; Cmd/Ctrl+B sidebar; Cmd/Ctrl+Shift+B right pane; Cmd/Ctrl+Shift+G diffs; Cmd/Ctrl+, settings — Flotilla equivalent: Web UI shortcuts
- `CAPY-444`: Option/Alt+1–9 jump to thread; Cmd/Ctrl+Option/Alt+Up/Down step — Flotilla equivalent: Web UI shortcuts
- `CAPY-445`: Ctrl+Shift+` new shell; Cmd/Ctrl+Shift+S side chat; Cmd/Ctrl+T tab (desktop) — Flotilla equivalent: Web UI shortcuts
- `CAPY-446`: Thread menu u/a/d; ⇧⌘M comment on message; C to annotate; ⌥1–9 model favorites — Flotilla equivalent: Web UI shortcuts
- `CAPY-447`: All shortcuts remappable in Settings → Shortcuts — Flotilla equivalent: Web UI shortcuts
- `CAPY-448`: Notification settings: requests and failures, sounds, system alerts, device/push — Flotilla equivalent: Notifications (web push / email / Slack)
- `CAPY-449`: Browser push per device (mentions, failures) even with Capy closed — Flotilla equivalent: Notifications (web push / email / Slack)
- `CAPY-450`: @-mention tags from Captains notify like mentions — Flotilla equivalent: Notifications (web push / email / Slack)
- `CAPY-451`: Unread badge on app icon — Flotilla equivalent: Notifications (web push / email / Slack)
- `CAPY-452`: Slack DM from Capy; PR merge/close follow-up sentence — Flotilla equivalent: Notifications (web push / email / Slack)
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-443, CAPY-444, CAPY-445, CAPY-446, CAPY-447, CAPY-448, CAPY-449, CAPY-450, CAPY-451, CAPY-452
