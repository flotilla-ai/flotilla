# phase2-17: Wake router and background waits

GOAL: Human/bot filtering, event subscriptions, timers, waiting labels, cross-thread messages. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-17-wakes
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/wakes*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/wakes*` only when this unit has UI rows
- `packages/**/wakes*` only when this unit owns adapter/package behavior
- `scripts/test-wakes*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-17-wakes.md`
- `docs/runlog/phase2-17.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `WakeSubscription`, `WakeTimer`, `WaitState`, `EventResponsePolicy`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-038` — Wake on human reviews/comments; bot feedback ignored by default (bot list). Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-039` — Wake on merge/conflict if someone wrote in the thread within N days (default 3, configurable). Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-040` — Wake on another agent (subagent done/blocked, message from another thread). Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-041` — Agent-set timers (up to 7 days). Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2); [CAP] timers must respect caps; a cap-paused thread doesn't wake-and-spend.
- `CAPY-043` — Per-event response setting: React / Keep as context / Ignore; org tab + personal override. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-044` — Waiting state names the awaited event ('Waiting on api#212 checks') with click-through. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-045` — Activity bar lists running watches with 'Stop watching'. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-046` — Long-running background command with explicit timeout (default 30 min, max 6 h) keeps machine awake while waited on. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2); [CAP] wall-clock + $ cap per command.
- `CAPY-047` — Ask for a plan first: agent writes a spec and stops for go-ahead (no plan mode). Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2); Flotilla could make plan-gate a first-class Approval.
- `CAPY-048` — Read another thread via @ or code (history, status, PRs, search, save to file) without waking it. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-049` — Message another thread (arrives as steer; reply wakes sender) only when asked. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2).
- `CAPY-050` — Thread on someone's computer holds incoming messages until owner allows. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2); [BYOM].
- `CAPY-051` — Background file transfers between any two machines. Flotilla equivalent: Wake router (event subscriptions + DB-backed timers; pg-boss from P2); [BYOM] over SSH/rsync.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-17.md`; never claim unrun behavior.

ROWS: CAPY-038, CAPY-039, CAPY-040, CAPY-041, CAPY-043, CAPY-044, CAPY-045, CAPY-046, CAPY-047, CAPY-048, CAPY-049, CAPY-050, CAPY-051
