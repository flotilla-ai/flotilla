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

Review round 1: Needs you now renders feedback drafts as an explicit "Open thread to send or discard" link instead of dead generic Approve/Raise/Stop buttons. Focused web proof: `src/features/needs-you/index.test.ts`, 1 passed.

Review round 2: Needs you now queries only `state=open` approvals, so answered/discarded/dismissed feedback drafts do not render stale action links.
