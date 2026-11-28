# captain-02 runlog

## Result

Built deterministic local Captain fixtures: six pages across three fake domains, deterministic search, webmail login/TOTP/inbox/send recording, shop order recording, and a tiny intentionally failing repo.

## Test output

```text
pnpm --filter @flotilla/server exec vitest run src/captain-fixtures/captain-fixtures.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

pnpm -r typecheck
exit 0

node --test evals/captain/fixtures/tiny-repo/test/add.test.js
exit 1: pass 0, fail 1 (intentional fixture failure)

make check
exit 0
```

## Notes

- No production runtime wiring and no real network services (measured).
- Fake domains are `news.fixture.test`, `mail.fixture.test`, `shop.fixture.test`; the fixture handle exposes Chromium `hostResolverRules` for local resolution.
- Injection text is served only as inert page/email fixture data (measured).
