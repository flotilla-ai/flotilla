# 08-auth-projects-api runlog

## DECISIONS

- Password hashes are scrypt with per-user salts; password and setup-token comparisons use constant-time equality after length checks.
- Auth credential/setup-token metadata lives in small auth-owned tables created by the auth store because the P1 schema has no password column.
- `requireSession` enforces the session cookie and CSRF centrally; `/api/v1` is now a valid mount root so the locked read paths can exist.
- Auth stores are cached per database URL so tests and composed apps do not accidentally share a pool across databases.

## Verification

```text
$ vitest run -- auth projects read

 RUN  v3.2.7 /home/ubuntu/repos/flotilla/apps/server

 ✓ src/loader.test.ts (3 tests) 35ms
 ✓ src/projects/projects-read.test.ts (2 tests) 1188ms
 ✓ src/events/store.test.ts (6 tests) 1271ms
 ✓ src/auth/auth.test.ts (2 tests) 1326ms

 Test Files  4 passed (4)
      Tests  13 passed (13)
   Start at  20:59:18
   Duration  1.58s (transform 191ms, setup 0ms, collect 385ms, tests 3.82s, environment 0ms, prepare 191ms)
```

### `make check` tail

```text
packages/adapters/claude-code lint: Done
packages/adapters/codex lint: Done
apps/gate lint: Done
packages/core lint: Done
packages/adapters/host lint$ oxlint src
packages/adapters/host lint: Done
packages/adapters/fake lint$ oxlint src
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/fake lint: Done
packages/adapters/generic-cli lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

## Unverified

- Browser cookie behavior is tested through emitted Set-Cookie attributes, not a real browser.
