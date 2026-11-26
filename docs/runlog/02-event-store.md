# 02-event-store runlog

## DECISIONS

- Used a PostgreSQL advisory transaction lock per thread to serialize sequence assignment; this keeps per-thread seq values gap-free under concurrent appends.
- `LISTEN/NOTIFY` payloads contain only `threadId` and `seq`; subscribers re-read rows by sequence, which also avoids payload-size and secret-exposure issues.
- Tests start a temporary `--rm` Postgres container on a random host port because the compose Postgres service intentionally has no published port.
- Added a `request_id` column on events for idempotent creation; duplicate requests return the originally inserted rows.

## Verification

### `pnpm --filter @flotilla/server test -- events`

```text
$ vitest run -- events

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/apps/server

 ✓ src/loader.test.ts (3 tests) 32ms
 ✓ src/events/store.test.ts (6 tests) 1265ms

 Test Files  2 passed (2)
      Tests  9 passed (9)
   Start at  20:27:19
   Duration  1.51s (transform 88ms, setup 0ms, collect 139ms, tests 1.30s, environment 0ms, prepare 99ms)
```

### `make check` tail

```text
apps/server test: Done
pnpm -r lint
apps/gate lint$ oxlint src
packages/adapters/claude-code lint$ oxlint src
packages/adapters/codex lint$ oxlint src
packages/adapters/fake lint$ oxlint src
packages/adapters/claude-code lint: Done
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/codex lint: Done
packages/adapters/host lint$ oxlint src
apps/gate lint: Done
packages/core lint$ oxlint src
packages/adapters/fake lint: Done
packages/adapters/host lint: Done
packages/adapters/generic-cli lint: Done
packages/core lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

## Unverified

- None. Tests used real Postgres in Docker and proved cross-connection `LISTEN/NOTIFY` delivery.
