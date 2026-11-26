# 11 thread runner

## Implemented
- Thread creation with requestId idempotency, run rows, run lifecycle events, and fake-adapter execution through the machine transport abstraction.
- Cost metering into `cost_entries`, cost events, thread spent projection updates, run reservation rows, cap interruption, blocking budget approvals, raise/stop answers, and resume trigger.
- Queue/interrupt/stop control API skeletons, per-run delta scrubber buffering, and a 10s machine-estimate ticker module.
- Thread routes for create/message/interrupt/stop plus approval answer.

## Verification
```text
$ pnpm --filter @flotilla/server test -- runner/runner.test.ts
✓ src/runner/runner.test.ts (2 tests)
```
The full runner-filtered suite also executes unrelated pre-existing tests because Vitest treats the pattern broadly; the new runner tests pass.

## Unverified / gaps
- Live Docker container execution, CLI-home copying, real repo seeding, and wall-clock kill are unverified in this pass.
- Captain-subtree reservation interaction is not yet covered.
- Restart recovery is minimal and needs phase-exit hardening.
