# phase2-01 runlog: API platform foundation

Rows: CAPY-453..462. All proven offline against a throwaway `postgres:16` container and the real route loader (`createApp()`); no vendor calls, so no row needs a human login.

## Focused test (measured)

```text
$ cd apps/server && npx vitest run src/api-platform --reporter=verbose
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-453: mints flt_ bearer keys only from an app session, honours expiry and revoke, has no rotate verb 43ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-454: keys act as a human or service principal with authorId attribution 19ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-455: replays a create with the same requestId instead of creating twice 16ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-456: cursor-paginates unbounded lists as {items, cursor}; bounded lists return {items} 18ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-457: SSE public frames carry type, resume id and retry 2000 104ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-458: errors are typed flotilla/* codes 8ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-459/460: legacy /tasks is still served and every documented flow route exists 1ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-461: POST /webhooks/automations/{secret} records a delivery for the matching automation 6ms
 ✓ src/api-platform/api-platform.test.ts > api platform > CAPY-462: uploads via a presigned URL, then attaches by fileId 15ms
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
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
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

## Devin Review round 1 (head c3485d3)

Fixed (focused test extended for each): mint responses are never cached or replayed (raw token stayed out of `api_idempotency`); webhook and upload bodies are read with a byte cap instead of buffered whole; SSE streams opened with an API key end within `keyRecheckMs` (30 s) after revoke/expiry; `serviceUser: { id }` lets a replacement key keep the same service user; a reused `requestId` with a different payload returns `flotilla/Conflict`.

Rejected: replayed upload grant after 15 min (replay returns the original response by design; its `expiresAt` tells the client to retry with a new `requestId`).

Escalated (fix lives outside SCOPE, pre-existing in `runner.ts`): `answerApproval` updates before its ownership check; `createThread` looks up `requestId` across all owners.
