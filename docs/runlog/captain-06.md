# captain-06 memory v2

## Claims

measured:
- `MemoryV2Service` supports scoped `captain`/`user` memories with deterministic retrieval, typed entries, automatic worklog writes, and stale-warning text `memory may be stale; re-check changing facts`.
- Secret-shaped input is refused before storage: password/card/OTP shapes and strings altered by the existing scrubber.
- `/mcp/memory` is exposed by the captain-tools HTTP service using the same per-run bearer token mechanism as `/mcp/captain`; ended runs lose access.
- Human inspection routes live under `/api/v1/captains/:id/memory` and enforce Captain ownership.
- This implementation is independent of the plain-thread Memory experiment flag.

## Test output

- `pnpm --filter @flotilla/server exec vitest run src/memory-v2/memory-v2.test.ts`: 6 passed.
- `pnpm -r typecheck`: exit 0.
- `make check`: exit 0 before merge-in of `flotilla/p1`; rerun attached in final PR checks if infrastructure output differs.

## Unverified

- No live model or vendor system was exercised; tests use in-memory SQL fixtures.
