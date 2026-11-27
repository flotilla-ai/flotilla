# phase2-02 runlog: Secrets vault and env API

Rows: CAPY-380, 382-389, 538-540. Proven offline against a throwaway `postgres:16` container, the fake adapter and a fake machine driver; no vendor calls, so no row needs a human login.

## Focused test (measured)

```text
$ cd apps/server && npx vitest run src/secrets --reporter=verbose
 ✓ src/secrets/secrets.test.ts > secrets vault > CAPY-380: values are envelope-encrypted at rest with the local KMS key and bound to their scope/name 29ms
 ✓ src/secrets/secrets.test.ts > secrets vault > CAPY-388/538/539/540: project env vars are set, listed and deleted via the API; values are write-only 20ms
 ✓ src/secrets/secrets.test.ts > secrets vault > CAPY-383/385/386: thread > personal > shared precedence; values decrypted only at machine preparation into a 0600 file outside the repo 153ms
 ✓ src/secrets/secrets.test.ts > secrets vault > CAPY-384/382: the model and the API see names and configured-state only; native export carries no values 122ms
 ✓ src/secrets/secrets.test.ts > secrets vault > CAPY-387: GitHub tokens are refused by the vault and never reach a machine 113ms
 ✓ src/secrets/secrets.test.ts > secrets vault > CAPY-389: per-thread env vars are accepted write-only on thread create and validated before the thread exists 112ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

## Done signal (measured)

```text
$ pnpm --filter @flotilla/server test
 Test Files  14 passed (14)
      Tests  58 passed | 1 skipped (59)
exit=0
```

```text
$ make check   (this branch; typecheck passes, lint passes when run alone: `pnpm -r lint` exit 0)
packages/core test:       Tests  15 passed (15)
apps/gate test:       Tests  5 passed (5)
packages/adapters/host test:       Tests  3 passed (3)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:    × git mirror > collects and pushes without token in mirror config or agent hooks/config running 475ms
apps/server test:  Test Files  1 failed | 13 passed (14)
apps/server test:       Tests  1 failed | 57 passed | 1 skipped (59)
apps/server test: Error: Cannot use a pool after calling end on the pool   (unhandled, src/runner/runner.test.ts teardown)
exit 2
```

`make check` failed in 5 of 5 runs on this branch, always in pre-existing tests outside phase2-02 scope. The same failures reproduce on unchanged `origin/flotilla/p1` (`daad0c8`, separate worktree):

```text
$ make check   (origin/flotilla/p1, unchanged)
apps/server test: Error: Cannot use a pool after calling end on the pool
apps/server test:       Tests  52 passed | 1 skipped (53)
apps/server test:      Errors  1 error
exit 2
$ cd apps/server && npx vitest run   (origin/flotilla/p1, unchanged, 3 runs with the marker name printed)
AssertionError: expected [ 'fs', true ] to deeply equal [ 'fs', false ]
```

- `git/mirror.test.ts`: the `core.fsmonitor` marker appears under full-suite load (passes alone: `npx vitest run src/git` 9 passed). Cause unverified.
- `runner/runner.test.ts`: `startNext` queries after the test pool ends (teardown race).

## Unverified

- Red-first run of `secrets.test.ts` was not captured; the test was written before `store.ts`/route/runner changes but first run after them.
- Live Docker: `/run/flotilla/secrets.env` mode/owner inside a real thread container (fake driver only). Command: `docker compose up -d --build`, create a thread with `environmentVariables`, then `docker exec <thread-container> stat -c '%a %u' /run/flotilla/secrets.env` (expect `600 1000`).
- API paths/body shapes are inferred, not from Capy fixtures.
- The two pre-existing `make check` failures above.

## Review round 1 (Devin Review on b6926e2)

Fixed: malformed env bodies now return 400 (028217c); vault failures fail closed, leaving no orphan thread, run row, budget hold or retry loop (c9b8632). Escalated: master key persistence in compose, core scrub 8-character minimum, prompt redaction of saved values versus CAPY-385, unkeyed idempotency fingerprint in api-platform. All four are outside phase2-02 scope or need a product decision.

```text
$ pnpm --filter @flotilla/server test
 Test Files  14 passed (14)
      Tests  60 passed | 1 skipped (61)
exit=0
$ make check   (local; same pre-existing failures as above)
apps/server test:    × git mirror > collects and pushes without token in mirror config or agent hooks/config running 250ms
apps/server test: Error: Cannot use a pool after calling end on the pool
apps/server test:       Tests  1 failed | 59 passed | 1 skipped (61)
exit 2
```
GitHub CI `check` on b6926e2: passed.
