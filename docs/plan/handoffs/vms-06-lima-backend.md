GOAL
Implement VM-005: Lima backend rendering per-Captain YAML for macOS vz and Linux qemu, driven through hostd, with golden tests and real boot only where hardware permits.

BRANCH: flotilla/vms-06-lima-backend
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: vms-02, vms-03, vms-04 and captain-03 merged
SCOPE: `apps/hostd/src/backends/lima/**` or `apps/server/src/compute-lima/**` (choose one owner based on hostd architecture), `deploy/lima/**` golden fixtures, `docs/runlog/vms-06.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Never run Lima/gVisor installers; no real login; no GPL/AGPL code copied into core. QEMU is external user-installed software only.
SHAPES
Types for Lima config render inputs and backend operations. Golden YAML fixtures cover macOS `vmType: vz` and Linux `vmType: qemu`, cpus/memory/disk, second data disk, no host mounts and no writable home mount. Snapshot semantics are typed per vmType.
DONE SIGNAL
Golden YAML tests pass on both OS variants; hostd fake/render tests pass; real `limactl` create/start/stop/delete is either measured where `/dev/kvm`/macOS exists or marked `unverified` with exact command; `make check` passes before merge.
EXPECTED
- YAML has no host mounts and no writable `~` mount.
- `limactl` is invoked through hostd argv arrays only, never shell strings.
- QEMU snapshots use `limactl snapshot`; vz uses stop+copy data disk and the decision is logged.
- License/dependency treatment for QEMU as an external user-installed program is recorded in decisions and notices.
- If the license treatment is judged disallowed, block only VM-005 Linux with the exact decision mehdi must make and keep the rest mergeable.
DIFF BUDGET: <= 14 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-005
