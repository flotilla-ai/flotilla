# 04-adapter-host runlog

## DECISIONS

- LocalTransport uses detached child processes and signals the negative process group id.
- Cancellation escalates SIGINT after 2 s, SIGTERM after 2 s, then SIGKILL within the 10 s bound.
- `runJsonl` emits `done:error` itself when a process exits nonzero without an adapter-provided done event.
- Streaming usage flags are implemented in the fake agent fixture runner for later units; MCP fixture POSTs are best-effort and untested here.

## Verification

### host tests

```text
$ vitest run --passWithNoTests

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/packages/adapters/host

 ✓ src/index.test.ts (1 test) 26ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  20:39:41
   Duration  258ms (transform 38ms, setup 0ms, collect 38ms, tests 26ms, environment 0ms, prepare 45ms)
```

### fake tests

```text
$ vitest run --passWithNoTests

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/packages/adapters/fake

 ✓ src/index.test.ts (3 tests) 351ms
   ✓ fake adapter > cancels a hanging process group within 10 seconds  321ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  20:40:48
   Duration  545ms (transform 42ms, setup 0ms, collect 46ms, tests 351ms, environment 0ms, prepare 41ms)
```

### generic-cli tests

```text
$ vitest run --passWithNoTests

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/packages/adapters/generic-cli

 ✓ src/index.test.ts (4 tests) 47ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  20:40:29
   Duration  253ms (transform 42ms, setup 0ms, collect 45ms, tests 47ms, environment 0ms, prepare 41ms)
```

### `make check` tail

```text
apps/gate lint$ oxlint src
packages/adapters/codex lint$ oxlint src
packages/adapters/codex lint: Done
packages/adapters/claude-code lint: Done
packages/core lint: Done
packages/adapters/host lint$ oxlint src
apps/gate lint: Done
packages/adapters/host lint: Done
packages/adapters/fake lint$ oxlint src
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/generic-cli lint: Done
packages/adapters/fake lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

## Unverified

- `--mcp-config` fixture POST behavior is implemented for unit 16 but not proven in this unit.
