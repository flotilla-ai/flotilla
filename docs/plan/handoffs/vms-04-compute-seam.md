GOAL
Implement VM-001: `ComputeDriver` seam in core plus a thin MachineDriver adapter, resolving to today's drivers by default with byte-identical default behavior.

BRANCH: flotilla/vms-04-compute-seam
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams and captain-04 merged
SCOPE: `packages/core/src/compute/**`, `apps/server/src/compute-driver/**`, focused dockerode snapshot tests in `apps/server/src/compute-driver/**`, `docs/runlog/vms-04.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Do not edit unblock-owned device/runner modules or existing `MachineDriver` implementation unless the shared-file protocol leaves a tiny additive seam; no backend implementation (vms-05/06).
SHAPES
Use the types in CAPTAIN-VMS §5.2: backend `docker|docker-isolated|lima`; `ComputeDriver` verbs capacity/create/start/stop/snapshot/restore/recreate/destroy/transport/cdpEndpoint. Adapter types map isolated Captain runs/crew threads into a computer workspace. Default resolver selects existing Docker behavior.
DONE SIGNAL
`pnpm --filter @flotilla/core exec vitest run src/compute/compute.test.ts` passes; `pnpm --filter @flotilla/server exec vitest run src/compute-driver/compute-driver.test.ts` passes; `make check` passes before merge.
EXPECTED
- `FLOTILLA_COMPUTE_ISOLATION` unset/off means no host helper contact and no behavior change.
- Snapshot test of dockerode calls for a default thread run and default computer start is unchanged versus pre-run behavior.
- Interface exposes capacity/create/start/stop/snapshot/restore/recreate/destroy/transport/cdpEndpoint exactly once.
- Adapter can route an isolated Captain's run/crew thread to a computer workspace in types/tests using fake backends.
- Missing/unimplemented backends fail closed with typed errors.
DIFF BUDGET: <= 13 files / <= 750 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-001
