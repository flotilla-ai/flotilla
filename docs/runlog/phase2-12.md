# phase2-12 machine core

Branch `flotilla/phase2-12-machine-core` from `origin/flotilla/p1` (`9fc248b`), then a real merge of `origin/flotilla/p1` `0662ec8` (phase2-06) `eba906f` (phase2-17) and `6b5546a` (repair-10, repair-12). Fake machine driver + local-process transport, temporary Postgres 16 container, server-rendered web component. No vendor calls or logins.

## Rows
- done: CAPY-201, CAPY-202, CAPY-203, CAPY-204, CAPY-205, CAPY-209, CAPY-210, CAPY-211, CAPY-213; CAPY-186 (phase2-10) moved to done now that boot/wake rerun startup entries.
- blocked: CAPY-206 (image only has Node 22, Python 3, git, pinned claude/codex; the rest of the toolchain is not installed), CAPY-207 (version detected and exported as `FLOTILLA_NODE_VERSION`; no other Node versions or version manager in the image), CAPY-212 (production `beforeDelete` does not push WIP; rebuild starts from the base branch).

## Changes
- `apps/server/src/machines/machine-core.ts`: sizes, plan gate, RAM admission (advisory lock, 60 s wait), lease lifecycle, wind-down/keep-awake/14-day delete `tick`, charge at sleep, environment boot wiring, `KERNEL_LIMITS`, `nodeVersionFrom`.
- `apps/server/src/db/migrations/0017_machine_core.sql`: `projects.machine_size`, `machine_leases`.
- `apps/server/src/routes/machine-core.route.ts`: `GET /machines/limits`, `GET|PUT /projects/:id/machine`, `GET /threads/:id/machine`, `POST .../machine/wake`, `PUT|DELETE .../machine/keep-awake`, `POST .../machine/tools/machine.set_size|machine.wake`.
- `apps/server/src/runner/runner.ts`: non-captain runs boot/hold/release the pool machine (`machineFor`), `wakeMachine`; start failures now end the run as failed.
- `apps/server/src/routes/threads.route.ts`, `apps/server/src/modules/runner.module.ts`: wire `machineCore()`, Docker driver hooks, `machine.state` events, 15 s tick (replaces the flat 10 s machine-estimate loop).
- `apps/server/src/environments/store.ts`: `prepare` takes an optional executor.
- `apps/web/src/features/machine-core/index.tsx` (`/machine`: size picker, limits, Wake, Keep awake 4 h / cancel) + test.

## Red first (server)
`npx vitest run src/machines/machine-core.test.ts` before the implementation existed:
```
Error: Cannot find module './machine-core.js' imported from '/home/ubuntu/repos/flotilla/apps/server/src/machines/machine-core.test.ts'
Caused by: Error: Failed to load url ./machine-core.js (resolved id: ./machine-core.js) in /home/ubuntu/repos/flotilla/apps/server/src/machines/machine-core.test.ts. Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
The web component test was written together with the component (no separate red run).

## Focused (after)
```
✓ src/machines/machine-core.test.ts > machine core > CAPY-201: sizes Small→Big Guy are plan-gated and size sets $/h that the cap accounts for 17ms
 ✓ src/machines/machine-core.test.ts > machine core > CAPY-202: the project Machine setting picks the size and the agent can change it 32ms
 ✓ src/machines/machine-core.test.ts > machine core > CAPY-203/210/213: billed only while awake incl. 2-min wind-down; sleeps after it unless kept awake 4 h; keep-awake cancels 29ms
 ✓ src/machines/machine-core.test.ts > machine core > CAPY-204/205: concurrent RAM is a hard cap; a start waits 1 min then fails; service-user threads get at most half 150ms
 ✓ src/machines/machine-core.test.ts > machine core > CAPY-209: kernel limits are documented and match the pool container config 1ms
 ✓ src/machines/machine-core.test.ts > machine core > CAPY-207: .nvmrc / .node-version pick the Node version 0ms
 ✓ src/machines/machine-core.test.ts > machine core > CAPY-210/211: the agent wakes a sleeping machine on a new message; the Wake button does too; startup entries rerun, disk is kept 364ms
 ✓ src/machines/machine-core.test.ts > machine core > CAPY-212: warns a day ahead, runs the pre-delete (WIP) hook, deletes after 14 sleeping days, rebuilds from the environment; failed resume rebuilds 24ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
✓ src/features/machine-core/machine-core.test.tsx > machine settings > CAPY-201/202/204/205/209: size picker gates by plan, shows $/h, RAM limits and kernel limits 8ms
 ✓ src/features/machine-core/machine-core.test.tsx > machine settings > CAPY-211/212/213: sleeping machine shows Wake + deletion date; kept-awake machine shows cancel 2ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

## `pnpm --filter @flotilla/server test`
```

 Test Files  22 passed (22)
      Tests  136 passed | 1 skipped (137)
   Start at  11:55:30
   Duration  7.59s (transform 1.21s, setup 0ms, collect 3.35s, tests 40.46s, environment 3ms, prepare 1.71s)

EXIT 0
```

## `make check`
```
apps/gate typecheck: Done
packages/core typecheck: Done
packages/adapters/host typecheck: Done
apps/web typecheck: Done
packages/adapters/codex typecheck: Done
packages/adapters/claude-code typecheck: Done
packages/adapters/fake typecheck: Done
packages/adapters/generic-cli typecheck: Done
apps/server typecheck: Done
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  8 passed (8)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  22 passed (22)
apps/server test:       Tests  136 passed | 1 skipped (137)
packages/core lint: Done
apps/gate lint: Done
packages/adapters/host lint: Done
apps/web lint: Done
packages/adapters/codex lint: Done
packages/adapters/generic-cli lint: Done
packages/adapters/claude-code lint: Done
packages/adapters/fake lint: Done
apps/server lint: Done
EXIT 0
```

## After merging `origin/flotilla/p1` `eba906f` and review fixes
`make check` (includes `pnpm --filter @flotilla/server test`):
```
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  6 passed (6)
apps/web test:       Tests  17 passed (17)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  24 passed (24)
apps/server test:       Tests  155 passed | 1 skipped (156)
apps/gate lint: Done
packages/core lint: Done
packages/adapters/host lint: Done
apps/web lint: Done
packages/adapters/codex lint: Done
packages/adapters/claude-code lint: Done
packages/adapters/fake lint: Done
packages/adapters/generic-cli lint: Done
apps/server lint: Done
EXIT 0
```
CI run 1 on `4f614c0` failed once in `runner-queue.test.ts` CAPY-476/026 (`usedTokens` 0 vs 1500); that test does not use `machines` and passed 3/3 locally in isolation and in the run above (unverified flake).

## Devin Review round 1 (`bf223f5`)
- fixed (`2063aec`): `sleep`/`delete` claim the lease row before touching the container, so a sweep read before a re-hold (or a second sweep) does nothing; `admit` returns busy when this thread's lease is already starting/awake, so competing wakes share one start; stuck `starting` leases go back to `sleeping` on `reset()`.
- fixed (`2063aec`, `f2229ca`): lease stores the project egress policy; an idle awake machine with a different policy is slept and restarted with the new gate policy; pool runs always rewrite `/run/flotilla/secrets.env`, so a previous owner's variables cannot survive.
- escalated: a failed resume deletes the workspace before rebuilding (CAPY-212 rebuild), and the 14-day delete has no production WIP push; both stay in CAPY-212's blocked remainder.
Red test before the fix: `review: a stale sweep cannot sleep a re-held machine ...` failed with `expected undefined to be false`.

## Unverified
- Real Docker sleep/wake with `flotilla-thread:dev` (container removal, volume reuse, `deleteWorkspace` volume removal) was not run; tests use a fake driver.
- `machine.state` events, the 15 s tick and `reset()` in a running server were not exercised end to end.
- The `/machine` page was rendered server-side only; no browser run.
- Prices are placeholders; no billing provider.
- A container that dies while its lease is `awake` is not detected until the server restarts (`reset()`).
