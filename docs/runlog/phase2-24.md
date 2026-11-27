# phase2-24: review core

Focused verification:

```text
✓ src/review-core/review-core.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

Dispositions:

- done: CAPY-131, CAPY-132, CAPY-133, CAPY-135, CAPY-136, CAPY-138, CAPY-139, CAPY-140, CAPY-141, CAPY-498
- blocked: CAPY-130 (no real checkout/agent execution yet), CAPY-134 (PR-page/@mention entry points not connected), CAPY-137 (adapter credential policy not enforced)

The durable core proves rounds, exact-head/read-only metadata, credit tiers, posting policy, finding validation, triage/readiness, suppression and incremental re-review semantics. It deliberately does not claim a live checkout or GitHub writeback.
