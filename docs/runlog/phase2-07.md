# phase2-07 thread lifecycle and collaboration

Branch `flotilla/phase2-07-thread-lifecycle` from `origin/flotilla/p1`. Fake adapter, temporary Postgres 16 container, no vendor calls or logins.

## Rows
CAPY-017, CAPY-018, CAPY-019, CAPY-020, CAPY-021, CAPY-022, CAPY-023, CAPY-024, CAPY-473, CAPY-474, CAPY-475 (all `done` in PARITY, pending merge).

## Changes
- `apps/server/src/db/migrations/0008_thread_lifecycle.sql`: thread visibility/title_source/archive/pin/tags/folder columns, `thread_members`, `thread_settings`.
- `apps/server/src/thread-lifecycle/{types,store}.ts`: `ThreadLifecycleStore` (actions, bulk, read-all, settings, title regeneration, message-triggered unarchive listener, idle sweep, cost).
- `apps/server/src/routes/thread-lifecycle.route.ts`, `apps/server/src/modules/thread-lifecycle.module.ts`.
- `apps/web/src/features/thread-lifecycle/`: Inbox page with archived toggle, mark-all-read, bulk toolbar, shift-click range selection, archive Undo, unread/mention marks and cost card.

## Red first
`npx vitest run src/thread-lifecycle` before `store.ts` existed:
```
Caused by: Error: Failed to load url ./store.js (resolved id: ./store.js) in /home/ubuntu/repos/flotilla/apps/server/src/thread-lifecycle/thread-lifecycle.test.ts. Does the file exist?
 Test Files  1 failed (1)
      Tests  11 skipped (11)
```

## Focused (after)
```
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-017: rename, regenerate with org+personal instructions (<=50 chars), regenerate-when setting 711ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-018: archive keeps events dormant; unarchive (undo) starts no run; a message unarchives and runs with prior context 146ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-019: bulk archive, tag, file, pin and delete report per-thread results 140ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-020: delete is a real hard delete and owner-only for private threads 44ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-021: read/unread state and unread mention badge per viewer 45ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-022: join, leave, subscribe and unsubscribe 49ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-023: take over a shared thread; the previous owner stays a member 22ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-024: share dialog transfers ownership; connections reset, vendor logins never move 26ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-473: idle auto-archive is off by default and skips pinned, open-PR and active threads 66ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-474: mark all as read includes archived threads 28ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts > thread lifecycle > CAPY-475: thread cost by token kind, model and machine 21ms
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

## Done signal: `pnpm --filter @flotilla/server test`
```
 Test Files  15 passed (15)
      Tests  73 passed | 1 skipped (74)
exit=0
```

## `make check`
```
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
apps/web test$ vitest run --passWithNoTests src
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  2 passed (2)
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:    × git mirror > collects and pushes without token in mirror config or agent hooks/config running 254ms
apps/server test: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
apps/server test: Error: Cannot use a pool after calling end on the pool
apps/server test:  Test Files  1 failed | 14 passed (15)
apps/server test:       Tests  1 failed | 72 passed | 1 skipped (74)
  × "pnpm recursive run" failed in /home/ubuntu/repos/flotilla/apps/server
exit=2
```

`make check` failed on 2 known, pre-existing flakes that are not in this unit's files. Both are recorded in `docs/runlog/phase2-02.md`: the `git mirror` assertion in `src/git/mirror.test.ts`, and the `runner.test.ts` teardown "Cannot use a pool after calling end on the pool". In the standalone done-signal run above, all 15 server test files passed. Typecheck and lint passed for every package.

## Unverified
- A model-backed title generator. The offline heuristic is tested, and the org and personal instructions it receives are asserted. No `needs-human-login` command is needed until a model unit wires one in.
- The web Inbox page has a unit test for range selection only. It has not been driven in a browser.
- Mentions match `@<email local part>` (substring match).
- Machine cost uses the thread's current machine.

## Review round 1 (Devin Review on 5a954e5)
- Resolved: former members of a now-private thread could still view or take it over (access now requires owner, shared or joined; takeover needs a shared thread). Takeover or transfer to a user who does not own the thread's project is now a 409. Streamed `agent.delta` replies now count as unread, and a run counts once with mentions matched across its deltas. The Inbox selection is cleared when switching the archived view.
- Escalated (pre-existing, outside this unit's scope; for a parent repair PR):
  - `read.route.ts` and `stream.route.ts` are owner-only, so joined collaborators cannot open shared threads from the Inbox.
  - The GitHub CheckMonitor wake (`github.module.ts`) runs `runner.message` on archived threads, and the kernel message unarchives them. The recommended fix is for the check monitor to skip archived threads.
- After the fixes: focused tests passed 11/11. `pnpm --filter @flotilla/server test`: 14/15 files and 72 tests passed, 1 skipped. The one failure is the known `git mirror` flake, which is not touched by this unit. Run alone twice, the same mirror file passed once (4/4) and failed once (1 failed | 3 passed).
