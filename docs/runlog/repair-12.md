# repair-12: make archived timer regression wait for the first timer run

## Goal
Fix the flaky phase2-17 regression that failed CI on repair PRs. The test counted runs before the first timer's asynchronous run had even been inserted, then mistook that legitimate first timer run for an archived-thread wake.

## Proof
Focused proof after the synchronization fix:

```text
$ pnpm --filter @flotilla/server exec vitest run src/wakes/wakes.test.ts --reporter=dot
Test Files  1 passed (1)
Tests  13 passed (13)
```

## Unverified
This is test synchronization only; it does not change wake delivery behavior.
