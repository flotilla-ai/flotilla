# phase2-10 development environments

Branch `flotilla/phase2-10-environments` from `origin/flotilla/p1` (`e07a117`, then merged `26f6713`). Local-process machine fixture, temporary Postgres 16 container, mocked-API browser test. No vendor calls or logins.

## Rows
- done: CAPY-189 (+ menu, browser e2e), CAPY-191 (`.flotilla/setup.json` / `.capy/setup.json` import after a run).
- blocked: CAPY-183 (container snapshot is phase2-11), CAPY-184, CAPY-185, CAPY-186, CAPY-187, CAPY-188, CAPY-190. The environment model, store, executor and API are proven, but production never registers a thread machine or calls `EnvironmentStore.prepare` / `EnvironmentExecutor.wake`. Wiring them belongs to phase2-12 machine core (`apps/server/src/runner/runner.ts` is outside this unit's scope). CAPY-190 also needs the tools in the Captain/agent tool registry.

## Changes
- `apps/server/src/environments/types.ts`: `EnvironmentSpec`, `SetupPhase`, `StartupEntry`, `NamedCommand`, `parseEnvironmentSpec` (defaults 900/300 s, 60-3600 s), `parseSetupFile`, `choosePhase`.
- `apps/server/src/environments/executor.ts`: `EnvironmentExecutor` (`bash -c` from repo dir with env, timeouts, readiness ports, wake, stop, named commands), `registerEnvironmentMachine` seam.
- `apps/server/src/environments/store.ts`: `EnvironmentStore` (versions, process state, menu, tools, `prepare`, `importFromMachine`).
- `apps/server/src/db/migrations/0012_environments.sql`, `apps/server/src/routes/environments.route.ts`, `apps/server/src/modules/environments.module.ts`.
- `apps/web/src/features/environments/index.tsx` (`/environments` editor + history, `EnvironmentMenu` + menu) and `apps/web/e2e/environments.spec.ts`.

## Red first
`npx vitest run src/environments` before the implementation existed:
```
Error: Cannot find module './types.js' imported from '/home/ubuntu/repos/flotilla/apps/server/src/environments/environments.test.ts'
 Test Files  1 failed (1)
      Tests  no tests
```

## Focused (after)
```
 ✓ src/environments/environments.test.ts > environments > CAPY-183: per-project spec with scripts, startup entries and commands keeps a versioned shared history 40ms
 ✓ src/environments/environments.test.ts > environments > CAPY-185: initialize (fresh clone, 900 s) and refresh (checkout moved, 300 s); timeouts must be 60-3600 s and are enforced 88ms
 ✓ src/environments/environments.test.ts > environments > CAPY-187: scripts run in bash from the repo dir with env vars; sudo is a machine capability, off by default 11ms
 ✓ src/environments/environments.test.ts > environments > CAPY-186/189: startup entries become ready on their port, show in the + menu with preview, and rerun on wake 275ms
 ✓ src/environments/environments.test.ts > environments > CAPY-188: named commands run on demand against the thread machine 16ms
 ✓ src/environments/environments.test.ts > environments > CAPY-190/184: environment tools read/replace the whole setup within boundaries and verify it on the thread machine 48ms
 ✓ src/environments/environments.test.ts > environments > CAPY-191: .capy/setup.json (and .flotilla/setup.json) in the repo import as a versioned setup 13ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

## Browser (`pnpm exec playwright test e2e/environments.spec.ts`)
```
  ✓  1 e2e/environments.spec.ts:3:1 › CAPY-189 + menu lists services, commands and terminals with status dots; CAPY-183 saves a new version (686ms)
  1 passed (1.7s)
```

## DONE SIGNAL `pnpm --filter @flotilla/server test`
```
 Test Files  18 passed (18)
      Tests  100 passed | 1 skipped (101)
```

## `make check`
```
packages/core typecheck: Done
apps/gate typecheck: Done
packages/adapters/host typecheck: Done
apps/web typecheck: Done
packages/adapters/fake typecheck: Done
packages/adapters/claude-code typecheck: Done
packages/adapters/codex typecheck: Done
packages/adapters/generic-cli typecheck: Done
apps/server typecheck: Done
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
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  18 passed (18)
apps/server test:       Tests  100 passed | 1 skipped (101)
packages/core lint: Done
apps/gate lint: Done
packages/adapters/host lint: Done
apps/web lint: Done
packages/adapters/fake lint: Done
packages/adapters/codex lint: Done
packages/adapters/claude-code lint: Done
packages/adapters/generic-cli lint: Done
apps/server lint: Done
exit=0
```

## Unverified
- No real Docker thread machine runs setup/startup yet (needs phase2-12 to call `registerEnvironmentMachine` + `prepare`); proven with a local-process transport.
- Readiness probe uses bash `/dev/tcp` inside the machine; not tried on a real machine image.
- `.capy/setup.json` field names are inferred; no real Capy file was available.
- Running scripts as the machine's sudo user and BYOM no-sudo are machine-image/device concerns (phase2-12, phase2-15); this unit only passes `FLOTILLA_SUDO` from caps.
- Terminals in the + menu are always empty until a terminal unit reports them.
- The web e2e uses a mocked API, not the live server.
