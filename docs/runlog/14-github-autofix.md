# 14 GitHub autofix

## Implemented
- GitHub API client for open-or-find PR, check runs, and bounded log tails; tokens stay inside the client and are never copied into thread env.
- `autofixDecision` kernel guard: cap at 3 attempts and stop on repeated error signature.
- PR persistence/opening helper around the git mirror push path.
- Polling monitor that wakes green once, emits untrusted truncated CI logs on failure, starts autofix wakeups, and creates a blocking decision approval at cap/no-progress.
- HMAC-verified public GitHub webhook route wired to the same monitor path as polling.

## Verification
```text
$ pnpm --filter @flotilla/server exec vitest run src/github/github.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```
Core autofix tests pass as part of `@flotilla/core` tests.

## Unverified / gaps
- Live GitHub API, real webhook delivery, and post-turn Docker collection are unverified.
- The production poller currently uses `GITHUB_TOKEN` because the vault is not a phase-1 unit; this is a phase-exit integration gap.
- Runner lifecycle currently removes containers after turns, so post-turn collection requires the runner lifecycle hardening noted in unit 11 review.
