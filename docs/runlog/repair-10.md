# repair-10: keep feedback drafts out of generic approval answers

## Goal
Close the phase2-06 escalation: a feedback draft shown on Needs you could be closed by the generic approval Approve path without using the explicit Send/Discard feedback flow.

## Proof
Failing first: the new regression resolved the generic answer instead of rejecting (`promise resolved ... instead of rejecting`).

After the fix:

```text
$ pnpm --filter @flotilla/server exec vitest run src/runner/runner.test.ts --reporter=dot
Test Files  1 passed (1)
Tests  5 passed (5)
```

No production behavior changes for non-feedback approvals.
