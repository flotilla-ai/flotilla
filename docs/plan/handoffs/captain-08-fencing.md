GOAL
Implement BEYOND-011: nonce-fenced untrusted content in every model-facing untrusted path covered by the Captain design.

BRANCH: flotilla/captain-08-fencing
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `apps/server/src/fencing/**`, focused integration edits in existing prompt/CI-log/crew-report paths only after the shared-file unblock check, `docs/runlog/captain-08.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. Do not edit unblock-owned files; do not weaken secret scrubbing; no broad refactors.
SHAPES
Use `fenceUntrusted` from core. Build a typed inventory of untrusted sources and regression helpers that detect nonce-shaped embedded closers. Integration points include web/research/page/snapshot content, email/page fixture text, CI logs, PR/issue bodies and crew reports. Where a file is held by unblock, implement a new wrapper seam and record the skipped file for track end.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/fencing/fencing.test.ts` passes; focused tests for each touched integration pass; `make check` passes before merge.
EXPECTED
- All fenced text uses `<untrusted source=... id=<random nonce>>` and a matching closer; random nonces differ between calls.
- Embedded nonce-shaped closers are stripped.
- Tests prove a prompt-injection fixture remains data and cannot close the fence.
- Existing CI-log and crew-report prompt paths use fencing when not blocked by active unblock work.
- Runlog lists every integration point as measured, deferred/skipped due to an unblock file hold, or not applicable.
DIFF BUDGET: <= 12 files / <= 650 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-011
