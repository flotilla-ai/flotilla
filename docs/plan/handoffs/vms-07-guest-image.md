GOAL
Implement VM-006: guest image/provisioning for isolated computers, reusing or extending the Captain browser computer image, non-root agent, Xvfb/Chromium/Playwright MCP, guest exec transport and two-disk layout.

BRANCH: flotilla/vms-07-guest-image
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-03 and vms-03 merged
SCOPE: `deploy/computer-isolated.Dockerfile`, `apps/guestd/**` or `apps/hostd/src/guest/**` (choose one owner based on transport design), `deploy/guest/**` provisioning scripts/golden files, `docs/runlog/vms-07.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Never edit `deploy/thread.Dockerfile`; no host mounts; no sudo for the agent user; no secrets or private keys in files/logs.
SHAPES
Provision inputs/outputs and guest exec protocol are typed. Guest user is `agent` without sudo. Data disk mount is `/home/agent`. SSH-with-generated-key or vsock transport key material stays in hostd data dir and is never logged. ProcessTransport interface is reused.
DONE SIGNAL
Provisioning render/unit tests pass; image build either passes or is `unverified (no docker/chromium in VM)` with exact command; `make check` passes before merge.
EXPECTED
- Ubuntu cloud-image provisioning for Lima and `deploy/computer-isolated.Dockerfile` for docker-isolated are golden-tested.
- Xvfb + Chromium + pinned Playwright MCP match the Captain computer image behavior.
- Guest exec agent implements ProcessTransport over the chosen channel.
- Data disk layout preserves `/home/agent`, browser profile and workspaces across recreate.
- Generated key handling test proves private key material is never printed in logs or committed fixtures.
DIFF BUDGET: <= 15 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-006
