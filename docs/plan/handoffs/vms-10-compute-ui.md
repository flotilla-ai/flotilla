GOAL
Implement VM-009: Settings -> Compute UI, per-Captain Own computer controls, lifecycle actions, action approval cards and capacity display.

BRANCH: flotilla/vms-10-compute-ui
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: vms-02, vms-09 and captain-12 merged
SCOPE: `apps/server/src/compute-settings/**`, `apps/server/src/routes/compute-settings.route.ts`, `apps/web/src/features/compute-settings/**`, route registration in `apps/web/src/main.tsx` if needed, `docs/runlog/vms-10.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Do not edit unblock-owned README or CAPY rows; no pills; no grey second hero line; no live backend dependency.
SHAPES
API types mirror compute settings, capacity, allocation state (`absent|creating|running|sleeping|destroying|error|unknown`) and lifecycle actions. Destroy/Recreate pass through captain action approval as delete/risky actions before execution.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/compute-settings/compute-settings.test.ts` passes; `pnpm --filter @flotilla/web exec vitest run src/features/compute-settings/compute-settings.test.tsx` passes; `make check` passes before merge; attach UI screenshots.
EXPECTED
- Settings -> Compute writes on/off without requiring server restart and displays host capacity allocated vs free plus detected backend.
- Per-Captain row shows disabled toggle with `Turn on in Settings → Compute` when global isolation is off.
- vCPU/RAM/disk inputs validate against kernel guard and show the orange capacity card on denial.
- Start / Sleep / Snapshot / Recreate / Destroy actions call the ComputeDriver through the server.
- Destroy and Recreate require approval cards first.
- Unknown state is shown honestly when a reply is lost.
DIFF BUDGET: <= 15 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-009
