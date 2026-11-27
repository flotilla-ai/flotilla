# repair-7: archived threads stay dormant on CI wakes

## Scope
Repair the phase2-07 escalation that the GitHub check monitor could message an archived thread, causing the lifecycle listener to unarchive it and start work. `CheckMonitor.process` still records CI events for the thread, but suppresses green/autofix agent wakes while `threads.archived_at` is set. A skipped wake does not consume the one-shot green wake or an autofix attempt, so the first active poll after unarchive can still wake the agent.

ROWS: none (integration repair; no parity rows claimed).

## Test-first proof
Before the fix, the new focused test failed as expected:

```text
expect(wakes).toEqual([])
 69|     });
 70|     expect(await monitor.process('o/r', 1, 'thr_archived', 'sha')).toB…
 71|     expect(wakes).toEqual([]);
       |                   ^
Test Files  1 failed (1)
Tests  1 failed | 5 passed (6)
```

After the fix:

```text
pnpm --filter @flotilla/server exec vitest run src/github/github.test.ts --reporter=dot
Test Files  1 passed (1)
Tests  7 passed (7)
```

Full gate:

```text
make check
apps/server test: Test Files 17 passed (17)
apps/server test: Tests 94 passed | 1 skipped (95)
pnpm -r lint: Done
```

## Decisions
- CI events are still appended once for archived threads so their event log remains current; only agent wakes are suppressed. Deferred green/autofix wakes are not marked consumed until actually delivered.
- Terminal autofix approvals may still be recorded. They do not start a run by themselves and are visible when the owner unarchives the thread.
- The archived check is re-run immediately before each wake, closing the check-log fetch race; a wake that lands after that check is still theoretically racy but no atomic wake/archive transaction exists yet.

## Unverified
- Live GitHub webhook behavior is fixture/unit-tested only; no real GitHub webhook or vendor run was used.
