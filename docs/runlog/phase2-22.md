# phase2-22: Captain digest and operations

Focused verification:

```text
✓ src/captain-ops/captain-ops.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)

✓ src/features/captain-ops/captain-ops.test.tsx (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

Dispositions:

- done: CAPY-080, CAPY-081, CAPY-082, CAPY-084, CAPY-085, CAPY-096, CAPY-100
- blocked: CAPY-076, CAPY-077, CAPY-078, CAPY-095, CAPY-098, CAPY-099, CAPY-495

The implemented slice is intentionally narrow: durable Captain documents/rules/messages/digest items, exact digest fallback and cap, one-line actionable digest commands, templates, and a small `/captain-ops` digest tab. It does not claim runner crew-event plumbing, automation-to-Captain handoff, sidebar integration, passing-mention work creation, or virtualized large crews.

Full verification:

```text
make check exit 0
apps/server: 43 test files passed, 253 passed, 1 skipped
```
