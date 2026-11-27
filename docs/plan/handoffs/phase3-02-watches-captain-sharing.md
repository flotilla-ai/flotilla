GOAL
Implement the smallest fixture-backed Flotilla foundation for background watches and captain sharing, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-02-watches-captain-sharing
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/watches, apps/server/src/captain-sharing, apps/web/src/features/captain-sharing, docs/runlog/phase3-02.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/02-watches-captain-sharing*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-042`: Agent-set watches on GitHub event / Slack channel / webhook URL (up to 30 days) — Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2)
- `CAPY-087`: Share Captain: everyone at org or specific people; crew access follows Captain; narrowing/widening confirms — Flotilla equivalent: Captain scheduler + Captain Drive files
- `CAPY-089`: Owner-only actions: rename, face/alias, Crew runs on, access, transfer, demote, delete — Flotilla equivalent: Captain scheduler + Captain Drive files
- `CAPY-093`: Steer a Captain from Slack with captain=<name|alias|code>, !queue/!steer — Flotilla equivalent: Captain scheduler + Captain Drive files
- `CAPY-494`: captain= in a Linear mention routes the ask to that Captain — Flotilla equivalent: Captain scheduler + Captain Drive files
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-042, CAPY-087, CAPY-089, CAPY-093, CAPY-494
