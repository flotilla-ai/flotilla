# 05-docker-driver runlog

## DECISIONS

- Docker archive APIs back copyIn/copyOut; the server never enters the thread filesystem itself.
- The one-shot CLI-home copier runs as root only to copy and chown the per-thread volume; it mounts the user volume read-only and excludes Claude `projects/` session transcripts.
- The reaper is opt-in with `FLOTILLA_REAPER=1` and does nothing without `DATABASE_URL`, rather than risking removal of live thread containers.
- `@flotilla/core` exports gained a development condition because Vitest does not build workspace dependencies before runtime value imports; this touches one file outside SCOPE and is logged here.

## Verification

### `FLOTILLA_DOCKER_IT=1 pnpm --filter @flotilla/server test -- machines`

```text
$ vitest run -- machines

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/apps/server

 ✓ src/loader.test.ts (3 tests) 41ms
 ✓ src/events/store.test.ts (6 tests) 2892ms
 ✓ src/machines/machines.test.ts (12 tests) 4760ms
   ✓ docker integration > hardens, isolates, cancels, copies cli home, copies files, and reaps  2710ms

 Test Files  3 passed (3)
      Tests  21 passed (21)
   Start at  20:49:46
   Duration  5.13s (transform 167ms, setup 0ms, collect 340ms, tests 7.69s, environment 0ms, prepare 170ms)
```

### `make check` tail

```text
packages/adapters/claude-code lint$ oxlint src
packages/adapters/fake lint$ oxlint src
packages/adapters/codex lint: Done
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/fake lint: Done
apps/gate lint: Done
packages/adapters/host lint$ oxlint src
packages/core lint$ oxlint src
packages/adapters/claude-code lint: Done
packages/adapters/host lint: Done
packages/adapters/generic-cli lint: Done
packages/core lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

## Unverified

- Claude/Codex install flags and versions are not installed in the image; the handoff allows local build args, but no vendor install documentation was verified in this unit.
- CLI-home exclusions beyond Claude `projects/` are unverified.
