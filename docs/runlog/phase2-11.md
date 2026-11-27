# phase2-11 snapshots

Branch `flotilla/phase2-11-snapshots` from `origin/flotilla/p1` (`0662ec8`), then real merges of `eba906f` (phase2-17) and `6b5546a` (repair-10). PR: https://github.com/flotilla-ai/flotilla/pull/50. Fixtures: temporary Postgres 16 container, local Docker containers (`postgres:16` image as the thread machine), mocked-API browser test. No vendor calls or logins.

## Rows
- done: CAPY-193 (repo selection + disk budget), CAPY-194 (64/128/256 GB tiers, smaller tiers), CAPY-195 (scrub + verify, leak refuses capture), CAPY-196 (history, per-step logs, "Ask why it failed").
- blocked: CAPY-192, CAPY-197. Capture and the hourly check run on every real completed run through `onAfterRun`, and the captured image boots in the test, but new threads still start `FLOTILLA_THREAD_IMAGE`: calling `SnapshotStore.bootPlan` at thread boot belongs to phase2-12 machine core (`apps/server/src/runner/runner.ts` is outside this unit).

## Changes
- `apps/server/src/snapshots/types.ts`: `SnapshotSpec`, `SnapshotTier`, `SnapshotBuild`, `SnapshotStepLog`, `BootPlan`, `parseSnapshotSpec`, `checkDiskBudget`, `tiersToCapture`, `rebuildDue`, `failurePrompt`.
- `apps/server/src/snapshots/builder.ts`: `buildSnapshot` steps setup → repos → scrub → verify → capture in a networkless copy container.
- `apps/server/src/snapshots/store.ts`: `SnapshotStore` (spec, rebuild request, history, `bootPlan`, `afterRun`).
- `apps/server/src/db/migrations/0018_snapshots.sql`, `apps/server/src/routes/snapshots.route.ts`, `apps/server/src/modules/snapshots.module.ts`.
- `apps/web/src/features/snapshots/index.tsx` (`/snapshots` settings + history) and `apps/web/e2e/snapshots.spec.ts`.
- Setup integration: reuses the thread's passed `environment_processes` setup or runs `EnvironmentExecutor.setup(spec,'initialize')`; repair-8 CLIs stay in the base image layers captured by `docker commit`.

## Red first
`npx vitest run src/snapshots` with only `types.ts` and the test:
```
Error: Cannot find module './store.js' imported from '/home/ubuntu/repos/flotilla/apps/server/src/snapshots/snapshots.test.ts'
 Test Files  1 failed (1)
      Tests  6 skipped (6)
```

## Browser
`pnpm exec playwright test e2e/snapshots.spec.ts`:
```
  ✓  1 e2e/snapshots.spec.ts:5:1 › CAPY-193/194 snapshot settings save repos, tier and smaller sizes; CAPY-196 history shows per-step logs and asks why it failed (750ms)
  1 passed (1.8s)
```

## make check after merging 6b5546a
```
apps/web test:  Test Files  6 passed (6)
apps/server test:  ✓ src/snapshots/snapshots.test.ts (6 tests) 34774ms
apps/server test:  Test Files  24 passed (24)
apps/server test:       Tests  153 passed | 1 skipped (154)
typecheck: 9 packages Done; lint: 9 packages Done; EXIT 0
```

## make check (after merging eba906f; includes `pnpm --filter @flotilla/server test`)
```
apps/server test:  ✓ src/snapshots/snapshots.test.ts (6 tests) 26150ms
apps/server test:    ✓ snapshots > CAPY-192: after a run the post-setup filesystem (workspace volume + home) is baked into an image that boots; hourly rebuild check  9322ms
apps/server test:    ✓ snapshots > CAPY-193: choose which project repos go in the snapshot; disk-budget validation refuses an image over the tier  3519ms
apps/server test:    ✓ snapshots > CAPY-194: disk tiers are 64/128/256 GB; "also snapshot smaller sizes" captures every smaller tier that fits  2151ms
apps/server test:    ✓ snapshots > CAPY-195: secrets are scrubbed (secrets file, history, env) and the filesystem is verified before capture; a leak stops capture  3800ms
apps/server test:    ✓ snapshots > CAPY-196: build history keeps per-step logs; "ask why it failed" gives the failed step log as a prompt  486ms
apps/server test:    ✓ snapshots > CAPY-197: a failing setup script never blocks boot: the last good image (or the base image) boots and the agent gets a repair prompt  2403ms
apps/server test:  Test Files  24 passed (24)
apps/server test:       Tests  152 passed | 1 skipped (153)
apps/web test:  Test Files  5 passed (5)
typecheck: 9 packages Done; lint: 9 packages Done; EXIT 0
```

## Unverified
- Capture from the real `flotilla-thread:dev` image with `DockerExecTransport` (tests use `postgres:16` and a docker-CLI transport): `docker build -f deploy/thread.Dockerfile -t flotilla-thread:dev . && pnpm --filter @flotilla/server test src/snapshots`.
- Tiers are not enforced as a Docker storage quota (no `--storage-opt size`); only the budget check.
- Secrets copied outside `/workspace /root /home /run /tmp` are not scanned.
- Snapshot images are local to the Docker host; no registry push or garbage collection of old builds.
- The after-run hook holds container removal while a build runs (up to the setup timeout).

## Parent integration after machine core (`ff759a5`)
- Runner machine startup now calls `SnapshotStore.bootPlan(projectId)` for project threads, starts the selected image, and prepends the repair prompt when the newest build failed. `defaultRunner` wires `snapshots: snapshotStore()`.
- Regression proof: `runner.test.ts` `CAPY-192/197` starts with `snapshot:image` and the adapter prompt contains the repair instruction.
- Focused proof: snapshots + runner tests `20 passed`.
- Full `make check` on the integration commit: `apps/server` 32 files / 230 passed, 1 skipped; typecheck and lint passed; exit 0.
- CAPY-192 and CAPY-197 are now `done` because boot wiring exists.
