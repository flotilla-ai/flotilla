# repair-5: runner background supervision

## Scope

Repair the pre-existing CI/test race from phase2-02: `startNext` postprocessing could still be querying Postgres after `runner.test.ts` closed its pool, producing an unhandled `Cannot use a pool after calling end on the pool` failure even when every test passed.

## Changes

- `apps/server/src/runner/runner.ts`: background `startNext` continuations are tracked instead of fired with bare `void`; rejection is contained rather than becoming an unhandled rejection. `drain()` waits until all tracked continuations, including queued follow-up runs, finish.
- `apps/server/src/runner/runner.test.ts`: test teardown drains runner background work before ending the pool.

## Verification

```text
$ cd apps/server && for i in 1 2 3; do npx vitest run src/runner/runner.test.ts --reporter=dot; done
Tests 4 passed (4)   # repeated 3/3, exit 0 each time
```

```text
$ cd apps/server && npx vitest run src --reporter=dot
 Test Files  14 passed (14)
      Tests  62 passed | 1 skipped (63)
exit=0
```

```text
$ make check
apps/server test:  Test Files  14 passed (14)
apps/server test:       Tests 62 passed | 1 skipped (63)
pnpm -r lint: exit 0
make check: exit 0
```

## Unverified

- This does not redesign crash recovery for a run interrupted while the server process exits; restart recovery belongs to the runner/lifecycle units.
