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
Follow-up while reviewing the start gate: budget raises now always enqueue the continuation message instead of relying on an empty run or a race with the paused run still being live.

Review round 2: budget raises do not duplicate a still-pending first prompt; Keep planning now queues a contextual `plan:true` revision prompt instead of relying on an empty run. Focused runner proof passes 9/9 after integration with repair-10.

Review round 3: Stop on a plan gate stops without queueing another planning turn. Plan approval now uses the first inbox prompt as the original request while taking the plan from the latest delivered run, so revised plans do not carry “do not implement” into implementation. Focused runner proof passes 10/10.

Review round 4: plan approval uses the user-authored `/plan` inbox item rather than the thread's first message; stopping a plan clears plan mode/needs-you and no longer leaves a stale cancellation that eats the next message. Focused runner proof passes 11/11.

Review round 5: repeated `/plan` sessions now bind approval to the latest user-authored plan request at or before the current planning run, not the earliest plan in the thread. Focused runner proof passes 13/13.

CI/typecheck fix: current-plan selection uses inbox `seq` rather than same-millisecond timestamps; focused runner proof passes 13/13 after merging Drive core.
