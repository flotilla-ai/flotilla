GOAL
Implement VM-008: egress-only-through-gate networking for both backends and extend isolation assertions to computers.

BRANCH: flotilla/vms-08-network-isolation
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: vms-02, vms-03, vms-04 and captain-03 merged
SCOPE: `apps/server/src/compute-isolation/**`, focused network policy fixtures under `apps/hostd/**` or `deploy/guest/**` only when owned by prior architecture, `docs/runlog/vms-08.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. No host firewall mutation in tests; no direct public egress; no docker.sock/host mounts/privileged/host network; no weakening gate policy.
SHAPES
Types for network posture, backend egress mode and assertion results. docker-isolated uses internal network + gate. Lima/QEMU uses user networking `restrict=on` plus forward to gate where available. Lima/vz guest nftables default-deny except gate plus HTTP(S)_PROXY is labelled weaker and `egress enforced inside the VM`.
DONE SIGNAL
Focused tests pass against mocked/docker/fake network state; real direct-public-IP curl refusal is measured where possible or `unverified` with exact command; `make check` passes before merge.
EXPECTED
- `assertIsolated` covers computers: no docker.sock, no host mounts, non-root, limits present, single internal network.
- docker-isolated egress goes through existing internal network + gate.
- Lima/QEMU egress plan uses restrict=on + gate forwarding; tests validate generated config.
- Lima/vz weaker guest-enforced mode is explicitly labelled in returned status and decision log.
- Direct public-IP egress test fails closed where executable; otherwise exact local command is recorded.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-008
