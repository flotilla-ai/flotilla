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
 ✓ src/environments/environments.test.ts > environments > CAPY-183: per-project spec with scripts, startup entries and commands keeps a versioned shared history 48ms
 ✓ src/environments/environments.test.ts > environments > CAPY-185: initialize (fresh clone, 900 s) and refresh (checkout moved, 300 s); timeouts must be 60-3600 s and are enforced 82ms
 ✓ src/environments/environments.test.ts > environments > CAPY-187: scripts run in bash from the repo dir with env vars; sudo is a machine capability, off by default 7ms
 ✓ src/environments/environments.test.ts > environments > CAPY-186/189: startup entries become ready on their port, show in the + menu with preview, and rerun on wake 260ms
 ✓ src/environments/environments.test.ts > environments > CAPY-188: named commands run on demand against the thread machine 21ms
 ✓ src/environments/environments.test.ts > environments > CAPY-190/184: environment tools read/replace the whole setup within boundaries and verify it on the thread machine 29ms
 ✓ src/environments/environments.test.ts > environments > CAPY-191: .capy/setup.json (and .flotilla/setup.json) in the repo import as a versioned setup 19ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

## Browser (`pnpm exec playwright test e2e/environments.spec.ts`)
```
  ✓  1 e2e/environments.spec.ts:3:1 › CAPY-189 + menu lists services, commands and terminals with status dots; CAPY-183 saves a new version (701ms)
  1 passed (1.7s)
```

## DONE SIGNAL `pnpm --filter @flotilla/server test`
```
 Test Files  20 passed (20)
      Tests  116 passed | 1 skipped (117)
```

## `make check`
```
apps/gate typecheck: Done
packages/core typecheck: Done
packages/adapters/host typecheck: Done
apps/web typecheck: Done
packages/adapters/codex typecheck: Done
packages/adapters/fake typecheck: Done
packages/adapters/claude-code typecheck: Done
packages/adapters/generic-cli typecheck: Done
apps/server typecheck: Done
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  2 passed (2)
apps/web test:       Tests  3 passed (3)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  20 passed (20)
apps/server test:       Tests  116 passed | 1 skipped (117)
apps/gate lint: Done
packages/core lint: Done
packages/adapters/host lint: Done
apps/web lint: Done
packages/adapters/fake lint: Done
packages/adapters/codex lint: Done
packages/adapters/claude-code lint: Done
packages/adapters/generic-cli lint: Done
apps/server lint: Done
exit=0
```

## Devin Review round 1 (`fe5e76e`)
- resolved: setup files are size-checked in the machine (regular file, max 64 KiB) before `copyOut` buffers them.
- resolved: the web editor sends `baseVersion`; stale saves get 409.
- resolved: `parseEnvironmentSpec` rejects null, arrays and non-object `setup`/phase sections (400).
- resolved: the + menu returns an empty menu for an owned thread with no project, instead of 409.
- escalated (out of scope): `apps/server/src/runner/runner-queue.test.ts` (phase2-05) is flaky in CI: CAPY-476/026 `usedTokens` 0 vs 1500 on `fe5e76e`, passed on rerun; phase2-04 PR CI also failed on CAPY-469 in the same file. Recommend a parent repair PR.

## Devin Review round 2 (`1c4a462`)
- resolved: an oversized `.flotilla/setup.json` stops the import; it no longer falls back to `.capy/setup.json`.
- CI rerun: `runner-queue.test.ts` CAPY-465 flaked once on `1c4a462` (same out-of-scope phase2-05 flake as round 1).

## Unverified
- No real Docker thread machine runs setup/startup yet (needs phase2-12 to call `registerEnvironmentMachine` + `prepare`); proven with a local-process transport.
- Readiness probe uses bash `/dev/tcp` inside the machine; not tried on a real machine image.
- `.capy/setup.json` field names are inferred; no real Capy file was available.
- Running scripts as the machine's sudo user and BYOM no-sudo are machine-image/device concerns (phase2-12, phase2-15); this unit only passes `FLOTILLA_SUDO` from caps.
- Terminals in the + menu are always empty until a terminal unit reports them.
- The web e2e uses a mocked API, not the live server.
