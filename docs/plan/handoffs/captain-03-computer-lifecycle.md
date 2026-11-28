GOAL
Implement BEYOND-001: a persistent per-user browser computer using a separate computer image, profile volume, isolated network, sleep/wake lifecycle and reconciliation.

BRANCH: flotilla/captain-03-computer-lifecycle
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `deploy/computer.Dockerfile`, `apps/server/src/computer/**`, `apps/server/src/routes/computer.route.ts`, `apps/server/src/modules/computer.module.ts`, `docs/runlog/captain-03.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. Never edit `deploy/thread.Dockerfile`; no computer proxy tools, live view, takeover or UI in this unit.
SHAPES
Use the seam migration tables. Type `Computer`, `ComputerScreen`, lifecycle state and driver-facing operations before logic. Chromium CDP binds to 127.0.0.1 inside the container. Docker tests may use mocked dockerode when Docker/Chromium is unavailable.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/computer/computer.test.ts` passes; `make computer-image` either builds or is recorded `unverified (no docker/chromium in VM)` with the exact command; `make check` passes before merge.
EXPECTED
- Image contains Debian slim, Chromium headful on Xvfb, no window manager, pinned Playwright MCP; licenses are checked and recorded.
- One long-lived `flt-computer-<userId>` container per user and one persistent `flt-computer-profile-<userId>` volume.
- No published ports; own Docker network; egress only through the gate; private/link-local/metadata destinations refused by policy reuse.
- Starts on first use, sleeps after `FLOTILLA_COMPUTER_IDLE_MIN` (default 15) with no screens, wakes on next use, profile persists.
- Per-run screens are browser tabs with cap `FLOTILLA_COMPUTER_MAX_SCREENS` (default 4).
- Only Captain runs or crew explicitly granted `computer: true` for the same user's project can allocate screens; reviews, PR/issue/CI-triggered runs and other principals are denied.
- Reaper/reconciliation test covers missing/stale containers.
DIFF BUDGET: <= 15 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-001
