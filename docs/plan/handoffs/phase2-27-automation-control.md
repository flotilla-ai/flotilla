# phase2-27: Automation operations and webhook safety

GOAL: Pause/resume/delete/restore/trigger/cancel, caps, batching, failure retention. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-27-automation-control
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/automation-control*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/automation-control*` only when this unit has UI rows
- `packages/**/automation-control*` only when this unit owns adapter/package behavior
- `scripts/test-automation-control*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-27-automation-control.md`
- `docs/runlog/phase2-27.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `AutomationControl`, `WebhookBatch`, `AutomationSkip`, `AutomationState`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-169` — Webhook body is data, never instructions. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads; prompt-injection boundary.
- `CAPY-170` — max_runs_per_day cap; over-cap events recorded as skipped. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads; [CAP] plus $/token caps per automation.
- `CAPY-171` — Automation Drive scope (state between runs). Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-172` — Per-run machine size. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-173` — Pause/resume, delete/restore, trigger, list/cancel runs, rotate webhook via API. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-175` — Failed run kept with full thread and output. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-501` — Filter automations by project/state/creation date (app, API, thread). Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-27.md`; never claim unrun behavior.

ROWS: CAPY-169, CAPY-170, CAPY-171, CAPY-172, CAPY-173, CAPY-175, CAPY-501
