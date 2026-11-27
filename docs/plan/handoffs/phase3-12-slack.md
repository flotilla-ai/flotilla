GOAL
Implement the smallest fixture-backed Flotilla foundation for slack integration, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-12-slack
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/slack-integration, apps/web/src/features/slack-integration, docs/runlog/phase3-12.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/slack*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-406`: Install Slack app from Capy settings; org-wide; default project for DMs/channels — Flotilla equivalent: Slack app
- `CAPY-407`: @Capy starts/continues a thread and replies in the Slack thread — Flotilla equivalent: Slack app
- `CAPY-408`: Thread controls: help, aside/!aside, mute/unmute, archive, stop, unlink, !web — Flotilla equivalent: Slack app
- `CAPY-409`: Channel → project mappings — Flotilla equivalent: Slack app
- `CAPY-410`: Directives project/folder/channel/title/model/reasoning/machine/captain — Flotilla equivalent: Slack app
- `CAPY-411`: Bang flags !new !web !fast !pro !standard !<effort> !queue !steer — Flotilla equivalent: Slack app
- `CAPY-412`: Personal Slack link; Read Slack as you (read-only) — Flotilla equivalent: Slack app
- `CAPY-413`: PR cards kept live from GitHub; merge from card turns on auto-merge — Flotilla equivalent: Slack app
- `CAPY-414`: Agent Slack tools: read, send (with files), react, list channels, DM you, wait for reactions, edit/delete own messages — Flotilla equivalent: Slack app
- `CAPY-415`: Aside prefix setting — Flotilla equivalent: Slack app
- `CAPY-515`: Admins can turn off Link to Capy thread and Post confirmations — Flotilla equivalent: Slack app
- `CAPY-516`: Read Slack as you can read a DM/private channel after per-thread allow — Flotilla equivalent: Slack app
- `CAPY-517`: Slack DM when a thread's PR merges — Flotilla equivalent: Slack app
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-406, CAPY-407, CAPY-408, CAPY-409, CAPY-410, CAPY-411, CAPY-412, CAPY-413, CAPY-414, CAPY-415, CAPY-515, CAPY-516, CAPY-517
