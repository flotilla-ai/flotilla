GOAL
Implement BEYOND-009: agent-driven skill capture saved as a draft, approved by the owner, then mounted and callable in later runs.

BRANCH: flotilla/captain-11-skill-capture
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `apps/server/src/skill-capture/**`, `apps/server/src/routes/skill-capture.route.ts`, focused additions to existing skills UI only if needed for draft approval display, `docs/runlog/captain-11.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No automatic execution of unapproved skills; no changes to CAPY skill rows or their ledger status.
SHAPES
Types for `skill.save({name,description,steps,validate,approvalBoundaries})`, draft storage in the user's Drive skills folder, approval state and later mount metadata. Reuse existing skills discovery/mount types rather than editing their core if possible.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/skill-capture/skill-capture.test.ts` passes; `make check` passes before merge.
EXPECTED
- `skill.save` writes a draft skill to Drive and creates an approval card `Save skill X?`.
- Before approval the skill is not mounted/callable.
- After approval a later fake run sees the skill in its mounted skill list and can call it by name.
- Approval boundaries are preserved in the stored skill text.
- Denial leaves the draft unmounted and auditable.
DIFF BUDGET: <= 12 files / <= 650 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-009
