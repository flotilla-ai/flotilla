GOAL
Implement BEYOND-007 and BEYOND-014: evidence-gated done, one output report shape, and the built-in `captain-core` playbook skill.

BRANCH: flotilla/captain-13-done-gate-report-playbook
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-09 and captain-12 merged
SCOPE: `apps/server/src/done-gate/**`, `apps/server/src/captain-playbook/**`, focused fixture additions under `packages/adapters/fake/fixtures/**`, `docs/runlog/captain-13.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No live vendor model eval; no changes to unblock-owned CAPY rows; no model-typed evidence accepted as proof.
SHAPES
Evidence types: command evidence captured by Flotilla (`cmd`, `exitCode`, `outputTail`), screenshot media id, checked link, research report id. Done decision type distinguishes `done` from `unverified`. `captain-core` skill content is data mounted for Captain/crew runs and states fencing/evidence/takeover rules.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/done-gate/done-gate.test.ts` passes; `make check` passes before merge.
EXPECTED
- Crew status `done` without evidence is stored `unverified` and appears in digest as In progress, not New.
- Command evidence is captured by Flotilla, not typed by the model.
- `verify.run` runs the project/environment test command and records exit code.
- Report render has Facts / Inferences / Done / Waiting on you / Couldn't verify.
- Research evidence passes only when checker passed; links are live-checked.
- Built-in `captain-core` playbook is mounted in Captain and crew fake runs and contains plan-act-verify, citation, evidence, takeover and measured/inferred/guess rules.
DIFF BUDGET: <= 13 files / <= 750 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-007, BEYOND-014
