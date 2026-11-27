# phase2-16: dock CLI foundation

Focused verification:

```text
✓ src/dock-cli/dock-cli.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

Dispositions:

- done: CAPY-252, CAPY-253, CAPY-254, CAPY-256, CAPY-258, CAPY-259
- blocked: CAPY-250, CAPY-251, CAPY-255, CAPY-257, CAPY-260

The implemented slice is local and offline: installer option validation, signed release verification, install layout/symlink/PATH mutation, directory add/remove persistence, command result shapes, OS-user isolation, and revocation classification. It deliberately does not claim end-to-end headless pairing, platform installer distribution, QR approval UX, supervisor integration, or automatic re-pairing.
