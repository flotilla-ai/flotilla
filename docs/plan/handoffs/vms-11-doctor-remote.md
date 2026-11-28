GOAL
Implement VM-010: `flotilla doctor`, computer shell command, web-shell transport reuse and remote-access documentation without installing or logging in to Tailscale.

BRANCH: flotilla/vms-11-doctor-remote
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: vms-03 and vms-09 merged
SCOPE: `apps/hostd/src/doctor/**` or `packages/core/src/doctor/**` plus the owning CLI package chosen by vms-03 architecture, `docs/remote-access.md`, `docs/own-computers.md`, `docs/runlog/vms-11.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Never edit unblock-owned `README.md`; never install Tailscale; never perform Tailscale login; no external network calls in tests.
SHAPES
Doctor check result types cover Tailscale presence, tailnet-only serve exposure, Funnel/public-bind warnings, SSH reachability and hostd health. CLI output is typed/rendered and fixture-tested. `flotilla computer shell <captain>` resolves through ComputeDriver transport.
DONE SIGNAL
Focused doctor/CLI tests pass with fixture command outputs; `make check` passes before merge.
EXPECTED
- `flotilla doctor` warns on Funnel or public `0.0.0.0` UI bind and reports hostd health.
- SSH/Tailscale checks use local command detection/fixtures only.
- `flotilla computer shell <captain>` uses Lima `limactl shell` or docker exec through the ComputeDriver transport.
- Web shell reuses the same transport seam.
- `docs/remote-access.md` covers Tailscale serve, Tailscale SSH, Headscale and plain SSH.
- `docs/own-computers.md` carries the Own computers optional documentation that would otherwise belong in README.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-010
