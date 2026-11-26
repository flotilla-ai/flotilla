# 06-claude-code-adapter runlog

## DECISIONS

- Fixtures are synthetic because the P2 Claude OAuth smoke test was not run and no real vendor login is allowed in this session.
- `runJsonl` now lets a parser return multiple AdapterEvents from one JSONL row because Claude assistant rows can contain both text and usage; this is a one-file correction outside SCOPE.
- `egressHosts` is `api.anthropic.com`, marked unverified because the P2 smoke check was not run.

## Verification

```text
$ vitest run --passWithNoTests

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/packages/adapters/claude-code

 ✓ src/index.test.ts (6 tests) 5ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  20:52:58
   Duration  243ms (transform 50ms, setup 0ms, collect 51ms, tests 5ms, environment 0ms, prepare 44ms)
```

### `make check` tail

```text
packages/adapters/codex lint: Done
packages/core lint: Done
packages/adapters/host lint$ oxlint src
packages/adapters/host lint: Done
packages/adapters/claude-code lint$ oxlint src
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/fake lint$ oxlint src
packages/adapters/fake lint: Done
packages/adapters/generic-cli lint: Done
packages/adapters/claude-code lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

## Unverified

- P2 OAuth smoke test was not run.
- Fixture field names are synthetic/unverified, including session id placement and mid-turn usage shape.
- Claude version range and egress host list are unverified.
