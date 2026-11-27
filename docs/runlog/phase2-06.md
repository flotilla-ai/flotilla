# phase2-06 runlog: Composer attachments and reading UX

Rows: CAPY-007, 012, 015, 016, 027, 032, 033, 034, 471, 472. Proven offline: server behavior against a throwaway `postgres:16` container with the fake adapter and a local HTTP tracker; web behavior with Vitest unit tests and Playwright against mocked `/api/v1` routes. No vendor calls, so no row needs a human login.

Reused, not duplicated: phase2-05 `POST /threads/:id/inbox` (attachments by file id, copied to `/run/flotilla/attachments`), `POST /approvals/:id/{later,dismiss}`; phase2-01 `POST /files` + `PUT /uploads/:id`; phase2-02 `PUT /me/environment-variables`; phase2-07 `ThreadLifecycleStore.list/view` for thread visibility.

New API (session required): `GET /thread-lookup?q=`, `GET /threads/:id/requests`, `POST /approvals/:id/undo`, `GET|PUT /threads/:id/reading-place`, `POST /threads/:id/feedback`, `POST /approvals/:id/feedback`. Migration `0013_thread_composer.sql` adds `approvals.detail` and `thread_reading_places`.

## Failing first (measured)

```text
$ cd apps/server && npx vitest run src/thread-composer
Error: Cannot find module '../routes/thread-composer.route.js' imported from '/home/ubuntu/repos/flotilla/apps/server/src/thread-composer/thread-composer.test.ts'
$ cd apps/web && npx vitest run src/features/thread-composer
 FAIL  src/features/thread-composer/thread-composer.test.ts [ src/features/thread-composer/thread-composer.test.ts ]
Error: Cannot find module './thread-composer.js' imported from '/home/ubuntu/repos/flotilla/apps/web/src/features/thread-composer/thread-composer.test.ts'
```

## Focused tests (measured)

```text
$ cd apps/server && npx vitest run src/thread-composer --reporter=verbose
 ✓ src/thread-composer/thread-composer.test.ts > thread composer > CAPY-015: request cards say exactly what is needed, open env/desktop inline, and Dismiss can be undone 77ms
 ✓ src/thread-composer/thread-composer.test.ts > thread composer > CAPY-016: thread codes resolve for Cmd+K and @-mentions only within threads the viewer may see 90ms
 ✓ src/thread-composer/thread-composer.test.ts > thread composer > CAPY-034: reading place is stored per viewer and survives a closed turn 33ms
 ✓ src/thread-composer/thread-composer.test.ts > thread composer > CAPY-472: a feedback report waits for owner approval, can be edited, and only then goes to the owner tracker 240ms
 ✓ src/thread-composer/thread-composer.test.ts > thread composer > CAPY-032: a thread without a project runs in a bare workspace with no repo checkout 259ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
$ cd apps/web && npx vitest run src/features/thread-composer --reporter=verbose
 ✓ src/features/thread-composer/thread-composer.test.ts > thread composer helpers > CAPY-007: send key is remappable per browser and the other Enter inserts a newline 2ms
 ✓ src/features/thread-composer/thread-composer.test.ts > thread composer helpers > CAPY-027: replies split into sections, Reply quotes one, and work between messages folds into one line 1ms
 ✓ src/features/thread-composer/thread-composer.test.ts > thread composer helpers > CAPY-016: @-mention query is the token under the caret 0ms
 ✓ src/features/thread-composer/thread-composer.test.ts > thread composer helpers > CAPY-471: ?prompt= deep link pre-fills the composer 0ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
$ cd apps/web && npx playwright test
  ✓   2 e2e/features.spec.ts:2:1 › needs-you approval actions post expected answers (974ms)
  ✓   3 e2e/core.spec.ts:8:1 › thread list, ordered seeded events, and cost meter render (957ms)
  ✓   1 e2e/thread-composer.spec.ts:20:1 › CAPY-007 + CAPY-012: send key remaps per browser; attached files upload and go to the inbox by file id (1.5s)
  ✓   4 e2e/thread-lifecycle.spec.ts:13:1 › CAPY-017/024 owner renames, regenerates, shares and transfers (1.2s)
  ✓   5 e2e/features.spec.ts:11:1 › new thread posts engine and micro-USD cap (746ms)
  ✓   6 e2e/core.spec.ts:12:1 › logged out API redirects to login (629ms)
  ✓   8 e2e/thread-lifecycle.spec.ts:19:1 › CAPY-022/023 collaborator joins, subscribes and takes over a shared thread (924ms)
  ✓   9 e2e/features.spec.ts:18:1 › interrupt posts interrupt then follow-up message (740ms)
  ✓   7 e2e/thread-composer.spec.ts:32:1 › CAPY-027 + CAPY-033 + CAPY-034: sections with Reply, folded work, message ticks, and reading place (1.3s)
  ✓  10 e2e/thread-lifecycle.spec.ts:25:1 › CAPY-017/473 org title instructions, regenerate-when and auto-archive settings (548ms)
  ✓  11 e2e/features.spec.ts:26:1 › project trust requires typed confirmation (531ms)
  ✓  12 e2e/thread-composer.spec.ts:41:1 › CAPY-015 + CAPY-472: request cards are exact, open env/desktop/feedback inline, and Dismiss has Undo (828ms)
  ✓  13 e2e/thread-lifecycle.spec.ts:31:1 › CAPY-018/019/020/021/474/475 bulk range archive+undo, delete, mark all read, mention badge, cost (831ms)
  ✓  14 e2e/thread-composer.spec.ts:54:1 › CAPY-472: /feedback in the composer drafts a report for owner approval instead of sending it (426ms)
  ✓  15 e2e/thread-composer.spec.ts:60:1 › CAPY-016: Cmd+K jumps to a thread by code and @ inserts a thread code (479ms)
  ✓  16 e2e/thread-composer.spec.ts:67:1 › CAPY-471 + CAPY-032: ?prompt= deep link pre-fills the composer and creates a no-project thread (343ms)
  16 passed (6.6s)
```

## Done signal (measured)

```text
$ pnpm --filter @flotilla/server test
 Test Files  20 passed (20)
      Tests  114 passed | 1 skipped (115)
$ make check
apps/gate test:       Tests  5 passed (5)
apps/gate test:  Test Files  2 passed (2)
apps/server test:       Tests  114 passed | 1 skipped (115)
apps/server test:  Test Files  20 passed (20)
apps/web test$ vitest run --passWithNoTests src
apps/web test:       Tests  7 passed (7)
apps/web test:  Test Files  3 passed (3)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
packages/adapters/host test:  Test Files  1 passed (1)
packages/core test:       Tests  15 passed (15)
packages/core test:  Test Files  6 passed (6)
EXIT 0
```

`make check` ran typecheck, test and lint for every package and exited 0. The known intermittent `apps/server/src/git/mirror.test.ts` `core.fsmonitor` failure did not occur in this run.

## Unverified

- No live browser run against a real server: the Playwright specs mock `/api/v1`. The server half of each row is proven separately by `thread-composer.test.ts`.
- CAPY-012: images are passed to vendors as files only. The fake adapter declares `images: false`, so native image input to Claude Code/Codex is unverified (needs a vendor login; owned by the adapter units).
- CAPY-472: the feedback tracker is any HTTP endpoint in `FLOTILLA_FEEDBACK_URL` that accepts `POST {title, body, threadId, threadCode}`. Not tried against GitHub/Linear. An agent-side MCP tool that drafts feedback is not wired; the owner drafts the report with `/feedback` or the API.
- CAPY-032: "This Mac" (paired host machine) without a repo is not exercised here. Only the pool machine `/workspace` path is proven.

## Devin Review round 1 (commit 7160463)

- Fixed: streamed `agent.delta` chunks now merge into one reply that gets sections and Reply buttons (unit test added).
- Fixed: Queue is disabled while files are still uploading, so a message cannot go out without its pending files.
- Fixed: the New thread composer no longer offers attachments. `POST /threads` cannot carry file ids yet, and the old follow-up "Attached files" message reached the agent after the first prompt had already started. Attach from the thread composer instead.
- Escalated: a feedback draft also shows on Needs you, and its generic Approve (`POST /approvals/:id/answer`) closes the draft without sending it. The fix belongs in the runner's generic answer path or the Needs-you filter (outside this unit).
- Escalated: to attach files to a thread's first prompt, `ThreadRunner.createThread` and `POST /threads` need to accept attachment ids (outside this unit).
- `make check` after round-1 fixes: exit 0; server 21 files, 123 passed, 1 skipped; web unit 5/5 composer; Playwright 16 passed.
