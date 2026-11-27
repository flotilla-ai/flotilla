# phase2-08 thread lifecycle API

Branch `flotilla/phase2-08-thread-api` from `origin/flotilla/p1` `bd40ab1`. Fake fixtures, temporary Postgres 16 container, bearer API keys minted from a local session. No vendor calls or logins.

## Rows
CAPY-544, CAPY-545, CAPY-546, CAPY-547, CAPY-548, CAPY-549, CAPY-550, CAPY-551, CAPY-552, CAPY-553, CAPY-554 (all `done` in PARITY, pending merge).

## Changes
- `apps/server/src/thread-api/types.ts`: `ThreadMutation`, `ThreadMembershipMutation`, `ThreadReadState`, `toReadState`.
- `apps/server/src/routes/thread-api.route.ts`: `POST /api/v1/threads/:id/{rename,archive,unarchive,takeover,regenerate-title,read,unread,join,leave,subscribe,unsubscribe}` over the phase2-07 `ThreadLifecycleStore.apply` (no duplicated lifecycle state, no migration).
- `apps/server/src/thread-api/access.ts` + `routes/read.route.ts` + `routes/stream.route.ts`: thread detail, messages and live stream are visible to the owner, joined members, and anyone on a shared thread (parent integration note).
- `apps/server/src/api-platform/API.md`: documents the verbs, response shapes and streamed `status` frames (enforced by the CAPY-459/460 route test).

## Red first
`npx vitest run src/thread-api` before the route and access changes:
```
   × thread lifecycle public API (bearer keys) > CAPY-544: POST /threads/:id/rename returns the thread and emits a status frame 26ms
   × thread lifecycle public API (bearer keys) > CAPY-545/546: archive and unarchive round-trip with status frames; active threads cannot be archived 11ms
   × thread lifecycle public API (bearer keys) > CAPY-547: POST /threads/:id/takeover moves ownership of a shared thread and streams the transfer 12ms
   × thread lifecycle public API (bearer keys) > CAPY-548: POST /threads/:id/regenerate-title returns an auto title of at most 50 chars and streams it 8ms
   × thread lifecycle public API (bearer keys) > CAPY-549/550: read and unread return the viewer read state and emit no shared frame 24ms
   × thread lifecycle public API (bearer keys) > CAPY-551..554: join, leave, subscribe and unsubscribe return membership; join/leave stream 6ms
   × thread lifecycle public API (bearer keys) > collaborators: joined or shared viewers can open detail, messages and the live stream; strangers cannot 17ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed (1)
      Tests  7 failed (7)
```
Representative failures:
```
     → expected 404 to be 200 // Object.is equality
     → expected { error: 'route not found', …(1) } to match object { status: 'archived', …(1) }
     → expected { error: 'route not found', …(1) } to match object { Object (ownerId, member) }
     → expected undefined to be 'auto' // Object.is equality
     → expected { error: 'route not found', …(1) } to deeply equal { threadId: 'thr_api6', …(5) }
     → expected undefined to match object { userId: 'usr_bob', …(2) }
     → expected { error: 'not found' } to match object { id: 'thr_api8' }
```

## Focused (after)
```
 ✓ src/thread-api/thread-api.test.ts (7 tests) 2081ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

## Done signal: `pnpm --filter @flotilla/server test`
```
   × git mirror > collects and pushes without token in mirror config or agent hooks/config running 207ms
 Test Files  1 failed | 16 passed (17)
      Tests  1 failed | 87 passed | 1 skipped (89)
  × "pnpm recursive run" failed in /home/ubuntu/repos/flotilla/apps/server
exit=1
```

## `make check`
```
apps/gate typecheck: Done
packages/core typecheck: Done
packages/adapters/host typecheck: Done
apps/web typecheck: Done
packages/adapters/claude-code typecheck: Done
packages/adapters/fake typecheck: Done
packages/adapters/codex typecheck: Done
packages/adapters/generic-cli typecheck: Done
apps/server typecheck: Done
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
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
apps/server test:    × git mirror > collects and pushes without token in mirror config or agent hooks/config running 192ms
apps/server test:  Test Files  1 failed | 16 passed (17)
apps/server test:       Tests  1 failed | 87 passed | 1 skipped (89)
  × "pnpm recursive run" failed in /home/ubuntu/repos/flotilla/apps/server
exit=2
```
`make check` stops at `pnpm -r test`, so lint was run separately: `pnpm -r lint` → `exit=0` (`apps/server lint: Done`).

The single failure is the known pre-existing `src/git/mirror.test.ts` "collects and pushes without token..." `core.fsmonitor` marker assertion (`mirror.test.ts:68`), already recorded in `docs/runlog/phase2-02.md` and `docs/plan/DECISIONS-LOG.md`. It does not load the app or any file in this unit. Run alone it passes:
```
$ cd apps/server && npx vitest run src/git
 Test Files  2 passed (2)
      Tests  9 passed (9)
```
All other 16 server test files pass, including `thread-lifecycle` and `api-platform`.

## Unverified
- Verb paths and response shapes are inferred (no Capy API fixtures in the repo).
- `regenerate-title` uses the offline heuristic generator; a model-backed generator is not wired (same as phase2-07). No `needs-human-login` command applies until a model unit wires one.
- Bearer keys and the session cookie share `requireSession`; only bearer calls are exercised here (session calls are covered by phase2-07 tests).

## Escalations (out of scope, not fixed)
- Joined collaborators can now read detail, messages and the stream, but `GET /threads` (list), `GET /approvals` and runner writes (`/message`, `/stop`, `/interrupt`, `/approvals/:id/answer`) stay owner-only (`ThreadRunner.owned`). Decide in a repair or collaboration unit whether joined members may drive a thread.
- The GitHub check monitor unarchiving archived threads (parent note) is not addressed here.

## Devin Review round 1 (on 8e27d56)
- Open streams: an open stream now rechecks `canViewThread` before delivering each `thread.status` frame, because access only changes through those events (visibility, leave, takeover). When access is gone, the stream ends before that frame and before anything after it. Fixed in bcdc694.
- Detail/messages TOCTOU: the visibility predicate (`viewable`) now runs in the same SQL statement as the fetch. Fixed in 1832650. The race itself has no test; the existing collaborator access tests cover the behavior.
- Idempotent replay of `204` (leaving a private thread with an `Idempotency-Key`) returned 500 because it replayed an empty body. It now replays a null body. Fixed in a6b7991.

Focused (`npx vitest run src/thread-api src/api-platform`):
```
 Test Files  2 passed (2)
      Tests  17 passed (17)
```
`pnpm --filter @flotilla/server test`:
```
   × git mirror > collects and pushes without token in mirror config or agent hooks/config running 205ms
 Test Files  1 failed | 16 passed (17)
      Tests  1 failed | 88 passed | 1 skipped (90)
```
The one failure is the same pre-existing `git/mirror` fsmonitor flake. `pnpm -r typecheck` and `pnpm -r lint` both end in `Done` with no errors.
