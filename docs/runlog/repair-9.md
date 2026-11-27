# repair-9: wait for persisted run-ended event in CAPY-469 test

## Goal
Remove the timing race escalated by phase2-04: the CAPY-469 runner-queue test read `run.ended` immediately after the run row became failed, before the runner necessarily persisted the event.

## Before
The assertion read `kinds(t.id, 'run.ended')[0]` without waiting and could fail intermittently in CI even though production behavior was correct.

## Fix
Use the test's existing `until` helper to wait until at least one `run.ended` event is persisted before asserting its error kind.

## Proof
Focused command:

```sh
pnpm --filter @flotilla/server exec vitest run src/runner/runner-queue.test.ts --reporter=dot
```

Output is recorded in the PR conversation/checks. No production code changed.

## Unverified
This removes one observed race; it does not prove there are no other timing races in the runner integration tests.
