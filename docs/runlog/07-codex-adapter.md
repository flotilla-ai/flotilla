# 07-codex-adapter runlog

## DECISIONS

- Fixtures are synthetic because the P3 Codex check was not run and live vendor login/API calls are forbidden here.
- API-key env var is `CODEX_API_KEY`, verified in the current Codex noninteractive docs; egress host remains unverified.
- The adapter-host multi-event parser correction is repeated in this branch because `turn.completed` carries usage and done in one row.

## Verification

```text
$ vitest run --passWithNoTests

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/packages/adapters/codex

 ✓ src/index.test.ts (4 tests) 3ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  20:54:09
   Duration  226ms (transform 43ms, setup 0ms, collect 45ms, tests 3ms, environment 0ms, prepare 49ms)
```

### `make check` tail

```text
packages/core lint: Done
packages/adapters/host lint$ oxlint src
packages/adapters/claude-code lint: Done
packages/adapters/host lint: Done
packages/adapters/codex lint$ oxlint src
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/fake lint$ oxlint src
packages/adapters/generic-cli lint: Done
packages/adapters/codex lint: Done
packages/adapters/fake lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

## Unverified

- `thread.started`, `item.started`, `item.completed`, `agent_message`, `command_execution`, `turn.completed`, and `cached_input_tokens` are verified in the current docs; detailed completion output fields remain partially unverified.
- Model flag spelling, version range, and egress host list are unverified.
