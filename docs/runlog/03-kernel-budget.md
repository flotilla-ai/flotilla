# 03-kernel-budget runlog

## DECISIONS

- Kernel budget functions are pure; database atomicity is left to the runner as required by the handoff.
- Token prices are zero-valued placeholders explicitly marked unverified; no vendor price was invented.
- Delta scrubbing holds back 127 bytes by default so split credential patterns can be redacted before output.

## Verification

### kernel tests

```text
$ vitest run -- kernel

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/packages/core

 ✓ src/kernel/scrub.test.ts (5 tests) 4ms
 ✓ src/kernel/branchGuard.test.ts (1 test) 2ms
 ✓ src/kernel/budget.test.ts (5 tests) 4ms
 ✓ src/types.test.ts (2 tests) 5ms

 Test Files  4 passed (4)
      Tests  13 passed (13)
   Start at  20:33:09
   Duration  301ms (transform 129ms, setup 0ms, collect 247ms, tests 15ms, environment 1ms, prepare 263ms)
```

### `make check` tail

```text
packages/adapters/codex lint: Done
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/fake lint: Done
packages/adapters/host lint$ oxlint src
packages/adapters/claude-code lint: Done
packages/core lint$ oxlint src
apps/gate lint: Done
packages/core lint: Done
packages/adapters/generic-cli lint: Done
packages/adapters/host lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

## Unverified

- `price-table.json` values are placeholders and intentionally unverified.
