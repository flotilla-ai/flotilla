# 15 previews

Implemented signed expiring share tokens, one-time preview cookie exchange, thread/port/code-scoped cookie checks, a separate `:8081` preview listener skeleton, and gate CONNECT dialing. Unit tests cover token signature/expiry/tamper rejection and cookie scoping.

```text
$ pnpm --filter @flotilla/server test -- previews
✓ src/previews/previews.test.ts (1 test)
```

Live Docker proxy integration, UI-cookie stripping behavior, and full upstream forwarding are unverified.
