GOAL
Implement VM-002: host capacity detection, quota allocation and kernel `compute` guard with zero-impact default behavior.

BRANCH: flotilla/vms-02-quota-guard
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `packages/core/src/kernel/computeGuard.ts`, `packages/core/src/kernel/computeGuard.test.ts`, `apps/server/src/compute-quota/**`, `apps/server/src/routes/compute-quota.route.ts`, `docs/runlog/vms-02.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. No hostd implementation, no backend driver, no UI.
SHAPES
Types: `HostCapacity`, `Quota`, `ComputeAllocation`, reserve settings and guard decision. Kernel guard is pure and hooks may only tighten. Defaults: host reserve 2 GB + 25% RAM, 1 CPU, 20 GB disk; Captain default 2 vCPU/4096 MB/32 GB; minimum 1/2048/16.
DONE SIGNAL
`pnpm --filter @flotilla/core exec vitest run src/kernel/computeGuard.test.ts` passes; `pnpm --filter @flotilla/server exec vitest run src/compute-quota/compute-quota.test.ts` passes; `make check` passes before merge.
EXPECTED
- RAM has no overcommit across running computers.
- CPU may overcommit at most 2x allocatable.
- Sum of max disk sizes is <= 0.9 x free disk.
- Start/create/resize that does not fit is denied and raises an orange decision card: `Not enough RAM: sleep Captain X or lower its RAM`.
- Budget exhaustion stops the computer through the allocation state API.
- With `FLOTILLA_COMPUTE_ISOLATION` unset/off, no host helper is contacted and behavior is unchanged.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-002
