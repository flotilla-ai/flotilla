# phase2-20: Captain creation and crew rules

GOAL: Create/promote/demote/archive/delete, crew membership rules and release. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-20-captain-create-crew
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/captain-create-crew*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/captain-create-crew*` only when this unit has UI rows
- `packages/**/captain-create-crew*` only when this unit owns adapter/package behavior
- `scripts/test-captain-create-crew*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-20-captain-create-crew.md`
- `docs/runlog/phase2-20.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `Captain`, `CrewMembership`, `CrewRefusal`, `CaptainPromotion`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-067` — New Captain dialog: name, face/avatar, project, machine, model, access. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-068` — Promote a thread (keeps history, PRs, machine, Slack thread, model, members). Flotilla equivalent: P2: promote keeps history, PRs, machine, model and members; the Slack-thread part arrives with Slack (P3)..
- `CAPY-069` — Promote a folder: its threads join the crew, folder removed. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-070` — Create a Captain by asking any thread ('Make a Captain called Mobile…'). Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-072` — Demote to thread / Archive (puts crew to sleep) / Unarchive / Delete (crew returns to list). Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-073` — Add existing threads to crew: drag, Move to, threads-page action, folder 'Add to Captain', or ask. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-074` — Crew rules: same project, not a subagent/Captain, one crew at a time; refusal reasons enumerated. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-075` — Captain removes/archives finished crew; release a thread yourself. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-088` — Captain always acts as its owner (owner's GitHub access and connections). Flotilla equivalent: Captain scheduler + Captain Drive files; [NOCLAUDE] runs on owner's adapters/logins on owner's machines.
- `CAPY-090` — Captain takes crew only from its project; one Captain per project for cross-project work. Flotilla equivalent: Captain scheduler + Captain Drive files.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-20.md`; never claim unrun behavior.

ROWS: CAPY-067, CAPY-068, CAPY-069, CAPY-070, CAPY-072, CAPY-073, CAPY-074, CAPY-075, CAPY-088, CAPY-090
