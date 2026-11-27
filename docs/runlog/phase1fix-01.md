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
