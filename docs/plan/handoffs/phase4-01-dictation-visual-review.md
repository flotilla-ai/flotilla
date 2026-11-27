GOAL
Implement the smallest fixture-backed Flotilla foundation for dictation and visual review evidence, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase4-01-dictation-visual-review
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/dictation-review, apps/web/src/features/dictation-review, docs/runlog/phase4-01.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/01-dictation-visual-review*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-011`: Dictation (mic) into the composer, auto-accept at 10 min, Undo — Flotilla equivalent: Thread + event log + web UI; [TX] Capy sends audio to ElevenLabs (SP); Flotilla: local or user-chosen STT
- `CAPY-147`: Visual check: run app, click through, attach screenshots/video to PR; mobile via cloud phone — Flotilla equivalent: Review agent = a read-only Thread on the PR head
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-011, CAPY-147
