GOAL
Implement the smallest fixture-backed Flotilla foundation for external automation triggers and operations, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-05-automations-external
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/automation-external, apps/web/src/features/automation-external, docs/runlog/phase3-05.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/automations-external*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-156`: Slack trigger: channel messages grouped into bursts (window 1–300 s, 20 msgs, 100 KB) — Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads
- `CAPY-157`: Slack reaction trigger — Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads
- `CAPY-158`: Linear triggers: issue created, status changed, cycle ended; team/label filters — Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads
- `CAPY-167`: Run-as principal (person or service user), re-verified every run; disabled visibly on offboarding — Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads
- `CAPY-168`: Any project member can run any automation — Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads
- `CAPY-174`: Quiet Slack posts; Matching pattern for Slack/webhook triggers; editable description — Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-156, CAPY-157, CAPY-158, CAPY-167, CAPY-168, CAPY-174
