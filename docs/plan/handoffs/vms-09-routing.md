GOAL
Implement VM-007: route isolated Captain runs, crew threads and computer tools into that Captain's own computer, preserving workspace separation, live view/takeover endpoint behavior and data disk persistence.

BRANCH: flotilla/vms-09-routing
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: vms-02, vms-03, vms-04, vms-05 and captain-07 merged
SCOPE: `apps/server/src/compute-routing/**`, focused integration edits in machine/computer routing seams after unblock check, `docs/runlog/vms-09.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Do not edit unblock-owned device plane modules; no UI (vms-10); no live vendor login.
SHAPES
Types map Captain compute mode `off|isolated`, computer id, thread workspace path and transport/cdp endpoint. One workspace directory per thread. Routing decisions are explicit and testable with fake ComputeDriver/MachineDriver implementations.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/compute-routing/compute-routing.test.ts` passes; `make check` passes before merge.
EXPECTED
- When Captain `compute.mode='isolated'`, its runs, crew threads and computer tools execute inside its own computer.
- Each thread receives a separate workspace directory and Linux user/context where supported.
- Live view/takeover use `cdpEndpoint()` unchanged.
- Fixture login cookie survives recreate and sleep/wake in fake/local fixture tests where backend supports it.
- Default off keeps current routing and passes zero-impact dockerode snapshot test.
DIFF BUDGET: <= 13 files / <= 750 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-007
