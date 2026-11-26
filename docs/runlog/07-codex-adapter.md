# 07-codex-adapter runlog

## DECISIONS

- Fixtures are synthetic because the P3 Codex check was not run and live vendor login/API calls are forbidden here.
- API-key env var is `OPENAI_API_KEY` and egress host is `api.openai.com`, both unverified against current Codex docs.
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

- Exact Codex JSONL event/type/item/usage field names are synthetic/unverified.
- Model flag spelling, API-key env var, version range, and egress host list are unverified.
