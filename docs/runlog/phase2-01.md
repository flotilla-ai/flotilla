# phase2-01 runlog: API platform foundation

Rows: CAPY-453..462. All proven offline against a throwaway `postgres:16` container and the real route loader (`createApp()`); no vendor calls, so no row needs a human login.

## Focused test (measured)

```text
$ cd apps/server && npx vitest run src/api-platform --reporter=verbose
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-453: mints flt_ bearer keys only from an app session, honours expiry and revoke, has no rotate verb 37ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-454: keys act as a human or service principal with authorId attribution 17ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-455: replays a create with the same requestId instead of creating twice 12ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-456: cursor-paginates unbounded lists as {items, cursor}; bounded lists return {items} 15ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-457: SSE public frames carry type, resume id and retry 2000 45ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-458: errors are typed flotilla/* codes 8ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-459/460: legacy /tasks is still served and every documented flow route exists 2ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-461: POST /webhooks/automations/{secret} records a delivery for the matching automation 4ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-462: uploads via a presigned URL, then attaches by fileId 12ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

## Done signal (measured)

```text
$ pnpm --filter @flotilla/server test
 Test Files  13 passed (13)
      Tests  50 passed | 1 skipped (51)
exit=0
```

```text
$ make check
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  13 passed (13)
apps/server test:       Tests  50 passed | 1 skipped (51)
exit 0
```

`make check` lint reports two pre-existing warnings (`apps/gate/src/main.ts:71`, `apps/server/src/runner/runner.ts:112`), none in this diff.

## Unverified

- Real browser `EventSource` reconnect sending `Last-Event-ID` (header path proven with a request header only). Local check: `curl -N -H "authorization: Bearer $KEY" -H 'last-event-id: 3' "$FLOTILLA/api/v1/threads/$THREAD/stream?frames=public"` against `docker compose up`.
- Capy's exact frame-type mapping for `turn`/`transcript` is inferred (see DECISIONS-LOG).
- Rate limit counters are per server process.
