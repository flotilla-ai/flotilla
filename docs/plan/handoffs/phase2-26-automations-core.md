# phase2-26: Automation triggers and runs

GOAL: Stored prompts, cron/webhook/GitHub/manual triggers, conditions, run gates, thread modes. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-26-automations-core
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/automations-core*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/automations-core*` only when this unit has UI rows
- `packages/**/automations-core*` only when this unit owns adapter/package behavior
- `scripts/test-automations-core*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-26-automations-core.md`
- `docs/runlog/phase2-26.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `Automation`, `AutomationTrigger`, `AutomationCondition`, `AutomationRun`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-152` — Automation = stored prompt per project + 1–20 OR'd triggers; each run is a normal thread. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-153` — Manage on Automations page or by asking the agent (full automation tools). Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-154` — Schedule trigger: 5-field cron + IANA tz, 5-min floor, DST-correct, missed runs coalesce. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-155` — GitHub trigger: PR opened/pushed/merged, comments, reviews, labels, checks, branch pushes, workflow_run. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-159` — Incoming webhook trigger: per-automation secret URL, Idempotency-Key, 256 KB cap, 202 accepted/duplicate/no-match. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads; Flotilla: add HMAC signature option.
- `CAPY-160` — Webhook batches (collect events into one run): list/flush/cancel. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-161` — On-demand trigger (button, API, agent). Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-162` — Trigger conditions: repos/branches/authors/labels, channels/authors/text, substring/regex. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-163` — run_when gate: a free fast-model check of fuzzy conditions. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads; [CAP][ADP] gate model must be configurable/free; count toward caps or explicitly exempt.
- `CAPY-164` — Pinned vs unpinned model; pin never silently substitutes. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-165` — Thread mode new vs single standing thread. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-166` — Run in an existing or private thread. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.
- `CAPY-500` — Several schedules per automation. Flotilla equivalent: Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-26.md`; never claim unrun behavior.

ROWS: CAPY-152, CAPY-153, CAPY-154, CAPY-155, CAPY-159, CAPY-160, CAPY-161, CAPY-162, CAPY-163, CAPY-164, CAPY-165, CAPY-166, CAPY-500
