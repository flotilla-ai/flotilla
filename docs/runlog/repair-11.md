# repair-11: accept attachments on a thread's first prompt

## Goal
Close the phase2-06 escalation: `POST /threads` and `ThreadRunner.createThread` could not carry composer attachment ids, so files could only be attached after the first prompt had already started.

## Proof
Failing first: the new regression reached `RunnerQueue.add` but failed validation because the id was never represented in the test file row; after inserting the upload row it proved the input was initially dropped. After implementing the input plumbing:

```text
$ pnpm --filter @flotilla/server exec vitest run src/runner/runner.test.ts --reporter=dot
Test Files  1 passed (1)
Tests  5 passed (5)
$ pnpm --filter @flotilla/server typecheck
exit 0
```

The regression proves the first inbox item carries `file_first` and enters `waiting_upload` until the upload completes.

## Unverified
The new-thread composer still does not expose attachment picking; this repair only makes the server/API path possible.

Review round 1: first-prompt uploads no longer start an empty agent run before files arrive; unknown attachment ids are validated before the thread row/event exist, so retrying the same idempotency key can correct the request. Focused runner proof now passes 6/6.
