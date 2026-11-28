GOAL
Write the Captain-quality exit report with rows by status, real eval scorecard, blocked causes, live checks for mehdi, unproven items and safety audit.

BRANCH: flotilla/captain-16-exit
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-15 merged
SCOPE: `docs/runlog/CAPTAIN-EXIT.md`, `docs/runlog/captain-16.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. Do not edit `PARITY.md`, `PROGRESS.md` or unblock-owned files; do not merge p1 into main.
SHAPES
Exit report is documentation only. Parent updates `PARITY-EXT.md` and `PROGRESS-PARALLEL.md` in a psync PR after merge.
DONE SIGNAL
On head of `flotilla/p1`: `make check`, `make eval-captain`, `docker compose up -d --build --wait`, `curl -fsS localhost:8080/healthz`, and `python3 docs/plan/scripts/parity_coverage.py P2/P3/P4` pass or are marked `unverified` with exact commands.
EXPECTED
- Rows BEYOND-001..015 are each done or blocked with a cause that truly needs mehdi.
- E1-E6 scorecard includes pass/fail, wall time, tool calls, cold start, warm wake, p50/p95.
- Live checks list real webmail takeover, adding a search API key, restart persistence and real-send approval.
- Safety audit covers secrets, licenses, direct pushes and main commits for this track's PRs only.
DIFF BUDGET: <= 4 files / <= 300 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: none
