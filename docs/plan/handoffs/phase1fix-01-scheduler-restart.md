# phase1fix-01: scheduler restart recovery

GOAL: prove Captain wake state is durable across a server restart: pending event wakes and heartbeat timers survive in Postgres, coalesce correctly, and fire after restart without depending on process memory.

BRANCH: flotilla/phase1fix-01-scheduler-restart
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase1-17-captain-scheduler, plan-p234

SCOPE:
- `apps/server/src/captain/scheduler/`
- `apps/server/src/modules/captain.module.ts`
- `apps/server/src/db/migrations/0003_event_ordering.sql`
- `apps/server/src/events/store.ts`
- `apps/server/src/captain/tools/service.ts`
- `docs/plan/handoffs/phase1fix-01-scheduler-restart.md`
- `docs/runlog/phase1fix-01.md`
- `docs/plan/PROGRESS.md`
- `docs/plan/PARITY.md`
- `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: Captain tool implementation, Docker/gate relay, UI, vendor adapters, broad runner redesign.

SHAPES: use the existing `captain_wakes` and `captain_scheduler_state` tables. Crew-event scanning uses a globally ordered event position allocated while the event transaction holds the single-row `event_order` lock, so an event that commits late cannot appear behind the persisted scan cursor. Event wakes are durable rows with `processed_at NULL` until delivered; heartbeat rows carry `idle_cycles`; wake delivery is at-least-once across a crash.

DONE SIGNAL:
```sh
pnpm vitest run apps/server/src/captain/scheduler/scheduler.test.ts
make check
```

EXPECTED:
- a real Postgres test writes an event wake, constructs a fresh scheduler against the same DB with a fake clock, and delivers it only when `pollDue()` runs after the simulated restart;
- multiple wake-worthy crew events inside the coalescing window produce one pending wake row with merged reasons;
- a due heartbeat survives the same simulated restart, fires once, and writes the next heartbeat with incremented idle backoff;
- events that occurred while the scanner was down are read from `captain_scheduler_state.last_event_at`, not a wall-clock-only recent window.

DIFF BUDGET: <= 10 files / <= 600 lines.

Context: phase 1 stored the tables but delivered event wakes immediately in memory and marked them processed at insertion time. This fix makes the database the restart-safe source of truth before phase 2 builds richer wakes/timers.

ROWS: CAPY-035, CAPY-036, CAPY-037, CAPY-079, CAPY-086
