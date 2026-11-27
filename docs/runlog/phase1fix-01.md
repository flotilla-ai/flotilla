# phase1fix-01: scheduler restart recovery

## Measured

```text
$ pnpm vitest run apps/server/src/captain/scheduler/scheduler.test.ts
✓ apps/server/src/captain/scheduler/scheduler.test.ts (2 tests)
Test Files  1 passed (1)
Tests  2 passed (2)
```

`make check` output is pasted in the PR body.

## What the test proves

- a wake-worthy crew completion is written as a durable unprocessed `captain_wakes` row instead of being delivered only in memory;
- a second wake-worthy event inside the coalescing window merges into the same row rather than creating a second wake;
- constructing a fresh scheduler against the same Postgres database (the simulated server restart) has no memory of the event, yet `pollDue()` delivers the pending wake;
- a heartbeat that becomes due before another simulated restart is still delivered by the fresh scheduler, then writes the next heartbeat with incremented idle backoff;
- event scanning uses `captain_scheduler_state.last_event_at` as a durable high-water mark rather than only reading a recent wall-clock window.

## Decisions

Wake delivery is at-least-once: rows are marked processed after the wake call, so a crash in the narrow acknowledgement window can duplicate a wake but cannot silently lose it.

## Unverified

A full compose server kill/restart is covered indirectly by the fresh-scheduler Postgres test; no separate supervisor-level process test was added in this small fix unit.

## Review repair 1

```text
$ pnpm vitest run apps/server/src/captain/scheduler/scheduler.test.ts
✓ apps/server/src/captain/scheduler/scheduler.test.ts (2 tests)
Test Files  1 passed (1)
Tests  2 passed (2)
```

```text
$ make check
Test Files  12 passed (12)
Tests  41 passed | 1 skipped (42)
exit 0
```

Repair scope: the scanner now persists the raw Postgres timestamp text as its high-water cursor, preserving microsecond precision, and wake acknowledgement only succeeds for the exact reasons snapshot delivered.

Unverified/known limit: if a Captain is already busy, `runner.message()` still stores the wake prompt only in process memory after appending the `user.message` event. A restart in that narrow state can lose the in-memory queued turn even though the wake row itself is durable. A durable thread inbox/runner redesign is out of this unit's scope and is escalated for a later runner-durability unit.

## Review repair 2

```text
$ pnpm vitest run apps/server/src/events/store.test.ts apps/server/src/captain/scheduler/scheduler.test.ts apps/server/src/projects/projects-read.test.ts apps/server/src/captain/tools/captain-tools.test.ts
Test Files  4 passed (4)
Tests  12 passed (12)
```

The scanner cursor is now `events.pos`, not a timestamp. Positions are allocated inside the same transaction as the event insert while holding the single-row `event_order` lock, preventing a late-committing event from becoming visible behind an already advanced cursor.
