# phase2-05 runlog: Durable runner queue and steer modes

Rows: CAPY-004, 009, 010, 026, 465-470, 476, 601, 603, 604. I proved them offline against a throwaway `postgres:16` container, a fake machine driver and scripted fixture adapters in `runner-queue.test.ts`. The adapters declare capabilities (`steerMidTurn`, `compaction`); none is a vendor. No row needs a human login.

Also included: if a run starts over the cap it now ends as `paused_budget` with `ended_at`, so the machine-time meter no longer bills it.

The runner background-work tracker has the same names as parent repair-5 (#33) (`supervise`/`drain`). `runner.test.ts` teardown is left to repair-5. The durable inbox needs the tracker for its own continuations and for module shutdown.

## Focused test (measured)

```text
$ cd apps/server && npx vitest run src/runner --reporter=verbose
 ✓ src/runner/runner.test.ts > thread runner > runs fake adapter events and is idempotent by requestId 130ms
 ✓ src/runner/runner.test.ts > thread runner > pauses at cap and raise resumes 222ms
 ✓ src/runner/runner.test.ts > thread runner > scopes requestId idempotency by owner 35ms
 ✓ src/runner/runner.test.ts > thread runner > does not mutate another owner approval before the ownership check 113ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-004: steer reaches a steer-capable agent mid-turn; without the capability it falls back to the queue 555ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-009/468/603/604: queued messages fold behind a count, can be edited, discarded back to the composer, or sent now 453ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-010/601: editing a sent message creates a new version the thread continues from 217ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-465: /plan explores first, holds changes and further messages until the plan is approved 723ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-466: /btw opens a side thread 22ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-467: a message sent while its file uploads waits durably and goes out after upload, even after a restart 528ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-469: a provider error is classified and Retry re-sends the last message, optionally on another model 217ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-470: request cards support Later and Dismiss server-side; a Captain dismisses all crew questions 29ms
 ✓ src/runner/runner-queue.test.ts > runner queue > CAPY-476/026: codemode inner tool calls stream live with their parent; the context meter and Compact at follow adapter capability 218ms
 ✓ src/runner/runner-queue.test.ts > runner queue > a run started over the cap ends as paused_budget instead of staying starting 211ms
 Test Files  2 passed (2)
      Tests  14 passed (14)
```

First run, before the error handler was added to the test app (5 failed, 5 passed; the failures were 500s that should have been typed 4xx errors):

```text
 ❯ src/runner/runner-queue.test.ts (10 tests | 5 failed) 21668ms
      Tests  5 failed | 19 passed (24)
```

## Done signal (measured)

```text
$ make check
apps/server test:  Test Files  15 passed (15)
apps/server test:       Tests  72 passed | 1 skipped (73)
make exit 0
```

```text
$ pnpm --filter @flotilla/server test   (3 runs)
   × git mirror > collects and pushes without token in mirror config or agent hooks/config running 303ms
 Test Files  1 failed | 14 passed (15)
      Tests  1 failed | 71 passed | 1 skipped (73)
$ cd apps/server && npx vitest run src/git
 Test Files  2 passed (2)
      Tests  9 passed (9)
```

`git/mirror.test.ts` failed in 3 of 3 runs, always on the `core.fsmonitor` marker. This is the same failure that phase2-02 recorded on unchanged `origin/flotilla/p1`. The file is outside phase2-05 scope. `Cannot use a pool after calling end on the pool` appeared 0 times in these runs.

## Unverified

- Red-first was partial: the test was written before `runner-queue.ts`, the route and the runner changes. Its first recorded run came after them, so the paused_budget regression was not run against the old runner.
- Web UI is not in this PR. The display of the folded queue count, request-card Later/Dismiss, codemode child-call nesting, the context meter and version arrows is unverified. Only the server APIs and events are proven.
- Live steer was not run against a real vendor. Claude Code and Codex declare `steerMidTurn: false`, so in practice steer falls back to the queue. Command once an adapter gains steer: `pnpm --filter @flotilla/server test -- runner-queue` with a real `claude` login, then send `{"text":"...","mode":"steer"}` to `POST /api/v1/threads/:id/inbox` while the thread is `working`.
- Live provider error strings are unverified. The classification regexes (429/rate limit, 529/503/overloaded, 401/403/auth, context/too long) are inferred, not taken from captured vendor output.
- No adapter exposes fork/rewind, so editing a sent message starts a new session from the edited version instead of rewinding the vendor session.
- API paths and body shapes are inferred, not taken from Capy fixtures.
