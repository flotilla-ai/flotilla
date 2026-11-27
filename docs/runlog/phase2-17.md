# phase2-17 wake router and background waits

Branch `flotilla/phase2-17-wakes` from `origin/flotilla/p1` (`ea9ec15`), then real-merged `9fc248b` (phase2-10). Fake adapter, fake job executor, temporary Postgres 16 container. No vendor calls or logins.

## Rows
- done: CAPY-038, CAPY-039, CAPY-040, CAPY-041, CAPY-044, CAPY-045, CAPY-047, CAPY-048, CAPY-049.
- blocked: CAPY-043 (server proven; no web settings screen), CAPY-046 (no machine idle-stop consumes `keepAwake`; no production machine executor yet), CAPY-050 (hold/allow proven; BYOM auto-hold and held-message UI need the BYOM unit), CAPY-051 (needs a BYOM machine with SSH).

## Changes
- `apps/server/src/db/migrations/0015_wakes.sql`: `wake_settings`, `wake_watches`, `wake_inbox`, `threads.hold_incoming`.
- `apps/server/src/wakes/types.ts`, `apps/server/src/wakes/router.ts`: `WakeRouter` (policy, GitHub review/comment/merge/conflict, subagent + reply wakes via LISTEN, timers/sweep, waiting state, watches/stop, peek, send, hold/release, background jobs, `rsyncArgv`).
- `apps/server/src/routes/wakes.route.ts`, `apps/server/src/modules/wakes.module.ts` (LISTEN + 15 s sweep; `FLOTILLA_WAKES=0` disables).
- `apps/server/src/routes/github-webhook.route.ts`: non-`check_run` events go to `WakeRouter.github`.
- `apps/web/src/features/wakes/index.tsx` (`/watches` Activity page with Stop watching).

## Red first
`npx vitest run src/wakes/wakes.test.ts` before `router.ts` existed:
```

 FAIL  src/wakes/wakes.test.ts [ src/wakes/wakes.test.ts ]
Error: Cannot find module '../wakes/router.js' imported from '/home/ubuntu/repos/flotilla/apps/server/src/routes/wakes.route.ts'
 ❯ src/routes/wakes.route.ts:3:1
      1| import { Hono, type Context } from 'hono';
      2| import { ApiFailure } from '../api-platform/types.js';
      3| import { WakeRouter } from '../wakes/router.js';
 Test Files  1 failed (1)
      Tests  no tests
```

## Focused (after)
```
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-038: human reviews/comments wake the thread; bots are ignored unless allow-listed 259ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-039: merge/conflict wakes only when someone wrote in the thread within the window (default 3 days) 136ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-040: subagent completion and blocking wake the parent 531ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-041: timers up to 7 days fire from the DB sweep; capped threads never wake 253ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-043: per-event React / Keep as context / Ignore with org default and personal override 343ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-044/045: waiting state names the event with a click-through; activity lists watches and Stop watching ends them 118ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-046: background command defaults to 30 min, max 6 h, keeps the machine awake and wakes on exit or timeout 309ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-047: /plan writes a spec and stops for approval with no vendor plan mode 525ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-048: peek reads another thread history/status/PRs, searches and saves to a file without waking it 149ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-049: cross-thread message arrives as a steer and the reply wakes the sender once 449ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-050: messages to a held thread wait until the owner allows them 269ms
 ✓ src/wakes/wakes.test.ts > wake router > CAPY-051: background transfer runs rsync over ssh through the job executor 127ms
 ✓ src/wakes/wakes.test.ts > wake router > routes: owner-only waiting, admin-only org settings, personal settings 127ms
 Test Files  1 passed (1)
      Tests  13 passed (13)
 ✓ src/features/wakes/wakes.test.tsx > wakes activity > CAPY-044/045: names the awaited event with a click-through and offers Stop watching 8ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

## `make check`
```
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  7 passed (7)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  22 passed (22)
apps/server test:       Tests  141 passed | 1 skipped (142)
make check exit=0
```

## Unverified
- Live GitHub App delivering `pull_request_review`, `pull_request_review_comment`, `issue_comment`, `pull_request` events (needs app subscription; only fixture payloads tested).
- Background jobs on a real machine (no production executor); machine kept awake while a job runs.
- BYOM SSH transfer and BYOM auto-hold.
- Timer sweep cadence in production (15 s interval, tested by calling `sweep` directly).
