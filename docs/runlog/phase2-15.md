# phase2-15: device execution foundation

Focused verification:

```text
✓ src/device-execution/device-execution.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

Dispositions:

- done: CAPY-249, CAPY-488
- needs-human-login: CAPY-423
- blocked: CAPY-244, CAPY-245, CAPY-246, CAPY-490

The implemented slice is an API/durable-state foundation: per-device worktree root validation with a 1 GB floor, cloud vs paired-device placement state, container isolation metadata, waiting-for-reconnect transitions, local-only opt-in import request validation, and Tailscale fixture validation using vault/secret OAuth references. It does not claim live device execution, history parsing, free-model policy, real Tailscale enrollment, or thread-row UI.

Tailscale operator verification command after a real login/client is configured:

```sh
curl -X PUT "$FLOTILLA/api/v1/devices/DEVICE_ID/tailscale" \
  -H "content-type: application/json" \
  --data '{"oauthClientRef":"vault:prod/tailscale-oauth","tags":["tag:runner"],"ephemeral":true,"acls":["tag:runner can reach tag:server"]}'
```

Full verification before integration merge:

```text
make check exit 0
apps/server: 45 test files passed, 255 passed, 1 skipped
```
