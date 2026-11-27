# phase2-25: review policy and guides

Focused verification:

```text
✓ src/review-policy/review-policy.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)

✓ src/features/review-policy/review-policy.test.tsx (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

Dispositions:

- done: CAPY-142, CAPY-143, CAPY-144, CAPY-148, CAPY-149, CAPY-150, CAPY-499
- needs-human-login: CAPY-145 — connect GitHub, enable `commitStatus`, run a review, and inspect the live PR commit status.
- blocked: CAPY-151 — machine read-only enforcement and 4 GB default are not wired to machine provisioning.

Implemented durable repo/path review context, ignore filters, deterministic AGENTS.md rule finding generation, guided-review structure, evidence attachment, timeout retry helper, and stack detection. The UI slice is `/review-policy`.

Full verification:

```text
make check
exit 0
```
