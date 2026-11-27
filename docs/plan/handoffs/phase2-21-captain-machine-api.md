# phase2-21: Captain machine, profile and API

GOAL: Owner acting, machine placement, alias/photo, large crew rendering, REST endpoints. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-21-captain-machine-api
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/captain-machine-api*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/captain-machine-api*` only when this unit has UI rows
- `packages/**/captain-machine-api*` only when this unit owns adapter/package behavior
- `scripts/test-captain-machine-api*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-21-captain-machine-api.md`
- `docs/runlog/phase2-21.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `CaptainProfile`, `CaptainPlacement`, `CaptainApi`, `CrewMutation`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-091` — Captain runs in cloud by default and sleeps between turns; can run on a paired device. Flotilla equivalent: Captain scheduler + Captain Drive files; [BYOM][CAP] idle Captain wakes cost money — cap Captain wake spend.
- `CAPY-092` — 'Crew runs on' setting: cloud or one paired device; name a machine per thread. Flotilla equivalent: Captain scheduler + Captain Drive files; [BYOM].
- `CAPY-094` — Captain Alias set in Profile. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-492` — API: create a thread in a Captain's crew, move threads in/out. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-493` — Captain photo upload or org library. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-555` — List Captains. Flotilla equivalent: Public REST + SSE API.
- `CAPY-556` — Create Captain. Flotilla equivalent: Public REST + SSE API.
- `CAPY-557` — Get Captain. Flotilla equivalent: Public REST + SSE API.
- `CAPY-558` — List Captain crew. Flotilla equivalent: Public REST + SSE API.
- `CAPY-559` — Add crew. Flotilla equivalent: Public REST + SSE API.
- `CAPY-560` — Remove crew. Flotilla equivalent: Public REST + SSE API.
- `CAPY-561` — Get Captain digest. Flotilla equivalent: Public REST + SSE API.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-21.md`; never claim unrun behavior.

ROWS: CAPY-091, CAPY-092, CAPY-094, CAPY-492, CAPY-493, CAPY-555, CAPY-556, CAPY-557, CAPY-558, CAPY-559, CAPY-560, CAPY-561
