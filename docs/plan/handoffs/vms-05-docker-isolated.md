GOAL
Implement VM-004: `docker-isolated` backend with one long-lived constrained container per Captain, separate system/data volumes, optional gVisor runtime and backend status reporting.

BRANCH: flotilla/vms-05-docker-isolated
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: vms-02, vms-03, vms-04 and captain-03 merged
SCOPE: `apps/hostd/src/backends/docker-isolated/**` or `apps/server/src/compute-docker-isolated/**` (choose one owner based on vms-03 architecture), `docs/runlog/vms-05.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Never mount docker.sock inside computers; no privileged/host network; no host home mounts; no editing `deploy/thread.Dockerfile`.
SHAPES
Backend state/types come from ComputeDriver. Container config types include `NanoCpus`, `Memory`, `MemorySwap=Memory`, `PidsLimit`, runtime, volume names and state. Two volumes are explicit: replaceable system layer and persistent data volume mounted at `/home/agent`.
DONE SIGNAL
Focused backend tests pass with mocked dockerode/fake backend; real Docker create/start/stop/destroy either passes or is `unverified (<reason>)` with exact command; `make check` passes before merge.
EXPECTED
- One long-lived container per Captain with CPU/RAM/swap/PID limits matching quota.
- Data volume preserves `/home/agent`, Chromium profile and workspaces; recreate replaces system layer only.
- Disk size cap uses xfs project quota when available or fixed-size loopback ext4; log which.
- `--runtime=runsc` is used only when detected in `docker info` runtimes; backend status reports which runtime is active.
- Destroy defaults to keeping disk and requires explicit `keepDisk:false` after approval.
- Isolation assertions prove no docker.sock, host mounts, privileged mode or host network.
DIFF BUDGET: <= 13 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-004
