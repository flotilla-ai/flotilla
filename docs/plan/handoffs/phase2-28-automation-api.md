# phase2-28: Automation REST API

GOAL: Automation CRUD, webhook rotation, batches, runs, enable/disable/delete/restore endpoints. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-28-automation-api
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/automation-api*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/automation-api*` only when this unit has UI rows
- `packages/**/automation-api*` only when this unit owns adapter/package behavior
- `scripts/test-automation-api*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-28-automation-api.md`
- `docs/runlog/phase2-28.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `AutomationApi`, `AutomationRunApi`, `WebhookRotation`, `BatchApi`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-521` — List batches. Flotilla equivalent: Public REST + SSE API.
- `CAPY-522` — Flush batch. Flotilla equivalent: Public REST + SSE API.
- `CAPY-523` — Cancel batch. Flotilla equivalent: Public REST + SSE API.
- `CAPY-524` — List automations. Flotilla equivalent: Public REST + SSE API.
- `CAPY-525` — Create automation. Flotilla equivalent: Public REST + SSE API.
- `CAPY-526` — Get automation. Flotilla equivalent: Public REST + SSE API.
- `CAPY-527` — Update automation. Flotilla equivalent: Public REST + SSE API.
- `CAPY-528` — Rotate automation webhook URL. Flotilla equivalent: Public REST + SSE API.
- `CAPY-529` — Trigger automation. Flotilla equivalent: Public REST + SSE API.
- `CAPY-530` — List automation runs. Flotilla equivalent: Public REST + SSE API.
- `CAPY-531` — Cancel automation run. Flotilla equivalent: Public REST + SSE API.
- `CAPY-532` — Enable automation. Flotilla equivalent: Public REST + SSE API.
- `CAPY-533` — Disable automation. Flotilla equivalent: Public REST + SSE API.
- `CAPY-534` — Delete automation. Flotilla equivalent: Public REST + SSE API.
- `CAPY-535` — Restore automation. Flotilla equivalent: Public REST + SSE API.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-28.md`; never claim unrun behavior.

ROWS: CAPY-521, CAPY-522, CAPY-523, CAPY-524, CAPY-525, CAPY-526, CAPY-527, CAPY-528, CAPY-529, CAPY-530, CAPY-531, CAPY-532, CAPY-533, CAPY-534, CAPY-535
