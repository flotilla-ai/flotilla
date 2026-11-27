# phase1fix-03 runlog: egress and preview fixtures

```text
$ ./scripts/test-egress-preview-e2e.sh
egress public=fixture-ok private_len=0 denied_len=0
preview bearer=200 no_token=401 ui_cookie=401 share=200 gate_no_token=403
egress preview e2e passed
```

This is real network traffic through compose and the gate. The local fixture uses a public-range Docker fixture network for the allowlisted “internet” case, a private-range fixture network for the public-IP rule, and a separate preview container behind the per-thread network. It proves allowlisted public egress succeeds, allowlisted private egress and unlisted public egress are denied, preview cookie/share access reaches the container, no token and UI-cookie-only access are rejected, and direct gate CONNECT without the bearer is rejected.

```text
$ pnpm --filter @flotilla/gate test
Test Files  2 passed (2)
Tests  5 passed (5)
```

```text
$ make check
Test Files  12 passed (12)
Tests  41 passed | 1 skipped (42)
exit 0
```

Repair made while proving this: gate admin/preview edge detection now treats all interfaces present at startup as the deployment edge plane instead of picking one arbitrary interface; thread networks attached later remain non-edge. Docker Hub rate limiting was bypassed locally by pulling the same Node base image through `mirror.gcr.io` and tagging it locally; no production image reference changed.
