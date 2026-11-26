# 10 egress gate

## Implemented
- Forward proxy on 3128 for CONNECT and absolute-form HTTP requests, with per-interface network rules.
- Exact and wildcard suffix allowlists; DNS is resolved once and every resolved address must be public before dialing the checked address.
- Edge-only bearer-controlled CONNECT to `flt-*` preview names.
- Relay on port 80 for `Host: flotilla-tools` and `/mcp/captain` only.
- Admin API on 3129 using the shared bearer token, with network upsert/delete.
- Server gate client plus thread driver hook that pushes the thread network allowlist on start and deletes it on removal.

## Verification
```text
$ pnpm --filter @flotilla/gate test
 Test Files  2 passed (2)
      Tests  5 passed (5)
$ pnpm --filter @flotilla/server test -- gate
 Test Files  4 passed (4)
      Tests  21 passed | 1 skipped (22)
```
`make check` passes.

## Unverified
- Live Docker curl-through-proxy integration is unverified in this pass.
- Real multi-interface Docker packet/local-address behavior is unverified; unit tests configure the interface map directly.
