# captain-04 runlog

## Result

Implemented the deterministic kernel action gate and server persistence seam:

- classification into `read`, `write-local`, and consequential kinds
- ask-first/allow rules capped at 20 each, ask-first precedence, hard always-ask classes
- hook composition can tighten but never loosen kernel decisions
- approval cards use kind `decision` with `detail.kind='action'`; always-allow omitted for purchase/delete/credential-entry
- background action cards carry a 30-minute expiry and expire endpoint
- denial audit rows are durable and are ignored after the next `user.message` event
- decisions append to `agent_audit`

## Test output

```text
pnpm --filter @flotilla/core exec vitest run src/kernel/actionGate.test.ts
Test Files  1 passed (1)
Tests  5 passed (5)

pnpm --filter @flotilla/server exec vitest run src/action-gate/action-gate.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

pnpm -r typecheck
exit 0

make check
exit 0
```

## Notes

- Browser/research proxy enforcement is intentionally left to captain-07 per scope.
- Rule persistence/retrieval UI is left to memory/rules units; the kernel enforces the 20+20 caps and service accepts rules at evaluation time.
