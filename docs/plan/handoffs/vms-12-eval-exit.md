GOAL
Implement VM-011 and write the T4 exit: `make eval-vms` scenarios E1-E7, scorecard, live-check commands, safety audit and `VMS-EXIT.md`.

BRANCH: flotilla/vms-12-eval-exit
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: every other vms unit and CAPTAIN-EXIT merged
SCOPE: `evals/vms/**`, `scripts/eval-vms*` (implementation scripts only; Makefile target already exists), `docs/runlog/VMS-EXIT.md`, `docs/runlog/vms-12.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. No real Tailscale login; no real VM boot unless hardware exists; do not edit unblock exits or merge p1 into main.
SHAPES
Eval result types mirror Captain eval. It may use fake backends where Docker/KVM/macOS is unavailable but must label real-backend coverage exactly. `vms-eval.json` is generated output.
DONE SIGNAL
On head of `flotilla/p1`: `make check`, `make eval-vms`, `docker compose up -d --build --wait`, `curl -fsS localhost:8080/healthz`, and `python3 docs/plan/scripts/parity_coverage.py P2/P3/P4` pass or are marked `unverified` with exact commands.
EXPECTED
- E1 default-off zero-impact dockerode snapshot passes.
- E2 quota denial creates orange card.
- E3 create -> sleep -> wake preserves fixture cookie.
- E4 recreate keeps data disk.
- E5 budget exhaustion stops computer.
- E6 egress outside gate refused.
- E7 crew thread lands in Captain computer.
- Records wall time, cold start and warm wake for each backend that ran.
- VMS-EXIT lists rows by status, blocked causes needing mehdi, live checks (Lima on Arch laptop and Mac, Tailscale), not-proven items and safety audit.
DIFF BUDGET: <= 15 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-011
