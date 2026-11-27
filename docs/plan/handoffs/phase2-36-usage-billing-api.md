# phase2-36: Usage, budgets and API models

GOAL: Machine-minute accounting, monthly windows, usage report/series/balance, model list. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-36-usage-billing-api
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/usage-billing-api*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/usage-billing-api*` only when this unit has UI rows
- `packages/**/usage-billing-api*` only when this unit owns adapter/package behavior
- `scripts/test-usage-billing-api*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-36-usage-billing-api.md`
- `docs/runlog/phase2-36.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `UsageReport`, `UsageSeries`, `BudgetWindow`, `MachineMinute`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-341` — Machine-minute accounting (1 per 4 GB per minute). Flotilla equivalent: P2: machine time is metered as `machineSec` in the cost ledger with an operator-set cost per runner type; no billing..
- `CAPY-346` — Auto-reload with threshold, target and monthly cap. Flotilla equivalent: P2: monthly window on the global/project budget (`BudgetPolicy.window`); P1 has lifetime caps the operator raises [CAP]..
- `CAPY-352` — Usage page: spend over window, credits vs subscriptions/keys, by member/model/thread, tokens. Flotilla equivalent: Cost ledger (per-thread CostEntry) + usage page; [CAP][TX] local usage ledger.
- `CAPY-353` — Usage API: report, series (hour/day by member/billing item/thread), balance. Flotilla equivalent: Cost ledger (per-thread CostEntry) + usage page.
- `CAPY-481` — When included usage runs out: switch threads to a free model or use credits (admin setting). Flotilla equivalent: P2: when a connection runs out, ask before switching engine (Approval); never a silent downgrade; no billing..
- `CAPY-635` — Get usage report. Flotilla equivalent: Public REST + SSE API; [CAP] backed by local spend ledger + caps.
- `CAPY-636` — Series. Flotilla equivalent: Public REST + SSE API; [CAP] backed by local spend ledger + caps.
- `CAPY-637` — Balance. Flotilla equivalent: Public REST + SSE API; [CAP] backed by local spend ledger + caps.
- `CAPY-639` — List. Flotilla equivalent: Public REST + SSE API.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-36.md`; never claim unrun behavior.

ROWS: CAPY-341, CAPY-346, CAPY-352, CAPY-353, CAPY-481, CAPY-635, CAPY-636, CAPY-637, CAPY-639
