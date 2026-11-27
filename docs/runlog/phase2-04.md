# phase2-04 runlog: Model policy and model API

Rows: CAPY-333, 335, 336, 337, 338, 484, 485. Proven offline against a throwaway `postgres:16` container, a scripted fake adapter (registered under the fake, claude-code and codex ids), fixture catalog rows and fixture keys. No vendor calls or logins.

## Failing first (measured)

The focused test was run against unchanged `origin/flotilla/p1` `914854c` (test file copied into a worktree):

```text
$ cd apps/server && npx vitest run src/models-catalog/model-policy-api.test.ts
Error: Cannot find module './model-policy-api.js' imported from '.../apps/server/src/models-catalog/model-policy-api.test.ts'
 Test Files  1 failed (1)
      Tests  9 skipped (9)
```

## Focused tests (measured, this branch)

```text
$ cd apps/server && npx vitest run src/models-catalog --reporter=verbose
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-336/484: GET /models has one row per model; a Claude subscription runs it before the key added earlier 8ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-333: default run-out policy is ask — a Wait/Use card; /continue moves to the next connection and reruns the prompt 155ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-333: /wait keeps the thread paused on its connection; no run starts 367ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-333: keep going switches without asking; ask before free asks only before the free models 125ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-337: the catalog context window (1.05M for GPT-6 on Codex) is listed and reaches the Codex CLI 57ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-485: changing a connection Base URL reaches the next run through the adapter base-URL env var 119ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-335: never use free models and exclude a company’s models (an adapter) apply to the list, picker, resolve and run-out 72ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > CAPY-338: background requests resolve to the user’s chosen model (or the thread’s), under the same policy 9ms
✓ src/models-catalog/model-policy-api.test.ts > model policy and model API > an engine whose adapter is not installed fails the run instead of running another adapter 25ms
Test Files  2 passed (2)
Tests  17 passed (17)

$ pnpm --filter @flotilla/web exec vitest run src
 ✓ src/features/model-policy-api/model-policy-api.test.tsx (3 tests)
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## Done signal (measured)

```text
$ make check   (typecheck and lint pass; server suite = pnpm --filter @flotilla/server test)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  3 passed (3)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:    × git mirror > collects and pushes without token in mirror config or agent hooks/config running 186ms
apps/server test: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
apps/server test:  Test Files  1 failed | 15 passed (16)
apps/server test:       Tests  1 failed | 78 passed | 1 skipped (80)
  × "pnpm recursive run" failed in /home/ubuntu/repos/flotilla/apps/server
exit=2
```

The one failure is the pre-existing `git/mirror.test.ts` fsmonitor-marker flake logged in phase2-02/phase2-03 (DECISIONS-LOG 2026-11-27); run alone on this branch it passes:

```text
$ cd apps/server && npx vitest run src/git/mirror.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## What shipped

- Types: `RunOutPolicy`, `ModelPolicy`, `ModelListItem`, `ConnectionPatch` (`models-catalog/types.ts`); catalog `contextWindow`; core `StartInput.contextWindow`, `AuthMethod` api-key `baseUrlEnvVar`, adapter `done.stopReason: 'run_out'`.
- Migration `0010_model_policy.sql`: `model_policies` per user; approvals kind `run-out`; runs state `run_out`.
- `GET /api/v1/models`, `POST /api/v1/models/background`, `GET|PUT /api/v1/me/model-policy` (`routes/model-policy-api.route.ts`; `ModelPolicyApi` lives in `models-catalog/store.ts`).
- Run order: enabled, non-failing, policy-allowed connections, subscriptions first, then owner → org → free. Policy exclusions apply to resolve, picker, list and run-out.
- Runner: a `run_out` stop re-queues the prompt and asks `runOut.onRunOut` — switch (keep-going / ask-before-free on a paid connection) or open a Wait/Use card and pause; answering Use re-resolves and reruns; `/wait` and `/continue` messages answer the card. A missing adapter fails the run instead of silently using the first adapter.
- `defaultRunner` registers fake, claude-code and codex adapters. Connection Base URL is validated http(s) and injected as the manifest `baseUrlEnvVar` (`ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`). Codex receives `-c model_context_window=<n>` when the catalog row has a window.
- Web `/models` page: run-out card (Wait/Use), policy form (run-out, never free, exclude adapter), model table (context window, connection order).

## Unverified (needs-human-login / blocked)

- CAPY-333: vendor CLIs do not yet emit `run_out` on a real usage limit; `claude auth login` / `codex login`, run until the subscription limit, record the CLI's last event.
- CAPY-337: `codex login && codex exec --json --model gpt-6 -c model_context_window=1050000 'say ok'` — model id and window are unverified; ship a catalog row only after checking.
- CAPY-484: `claude auth login`, connect the subscription, run a Claude-model thread without `ANTHROPIC_API_KEY`.
- CAPY-485: `ANTHROPIC_BASE_URL=<gateway> claude -p ok --bare` with the operator's key; Codex honouring `OPENAI_BASE_URL` unverified. Web connection editor is absent (blocked with CAPY-332).
- CAPY-338: phase2-07 titles use the offline heuristic `TitleGenerator`; no model-backed title/PR-summary generator calls the background resolver yet (blocked).
- Diff budget: 13 code/test files plus the 4 required ledger files (17 total); the 15-file budget is exceeded only by the ledgers.

## After merging `origin/flotilla/p1` `e07a117` (phase2-07, repair-6)

```text
$ pnpm --filter @flotilla/server test
 Test Files  17 passed (17)
      Tests  90 passed | 1 skipped (91)
exit=0
```

```text
$ make check   (after the merge)
apps/server test:  Test Files  17 passed (17)
apps/server test:       Tests  90 passed | 1 skipped (91)
exit=0
```

## Devin Review round 1 (commit `afc5956`)

- Claude runs ignore the selected model — fixed: Claude Code argv adds `--model <model>`.
- Default threads ignore never-free policy — fixed: a thread without `engine` resolves `{adapter:'fake'}` through the policy, so never-free rejects it.
- Missing vendor CLIs in thread containers — escalated: `deploy/thread.Dockerfile` ships neither `claude` nor `codex`; such runs now fail visibly (before this PR they silently ran the fake adapter). Installing the CLIs is a parent deploy repair outside this unit's scope.
- Pending subscriptions outrank connected keys — escalated: phase2-03 gives every subscription `needs-login` (the login happens inside the CLI), so demoting them would make CAPY-484 unreachable; a server-side login probe is needed (CAPY-484 stays needs-human-login).

```text
$ pnpm --filter @flotilla/server test
 Test Files  17 passed (17)
      Tests  90 passed | 1 skipped (91)
exit=0
$ pnpm --filter @flotilla/adapter-claude-code test
      Tests  7 passed (7)
```

## After merging `origin/flotilla/p1` `26f6713` (phase2-05 runner queue)

Run-out now re-adds the claimed inbox item (priority 1) instead of the removed in-memory queue; `adapterFor` no longer falls back to the first adapter; `retry` carries the resolved `contextWindow`.

```text
$ cd apps/server && npx vitest run src/models-catalog src/runner
 Test Files  4 passed (4)
      Tests  33 passed (33)
$ make check
apps/web test:       Tests  5 passed (5)
apps/server test:  Test Files  18 passed (18)
apps/server test:       Tests  102 passed | 1 skipped (103)
exit=0
```

## After merging `origin/flotilla/p1` `505d663` (phase2-08 thread API)

Docs-only conflicts (DECISIONS-LOG, PROGRESS); both sides kept.

```text
$ make check
apps/web test:       Tests  5 passed (5)
apps/server test:  Test Files  19 passed (19)
apps/server test:       Tests  110 passed | 1 skipped (111)
exit=0
```

## After merging `origin/flotilla/p1` `ea9ec15` (phase2-09 previews)

PROGRESS.md-only conflict; both unit entries kept.

```text
$ make check
apps/web test:       Tests  6 passed (6)
apps/server test:  Test Files  20 passed (20)
apps/server test:       Tests  118 passed | 1 skipped (119)
exit=0
```

## CI flake on `dfe3c68` and diff reduction

CI `check` failed once in phase2-05's `runner-queue.test.ts` CAPY-469: the test reads `run.ended` right after the `runs` row turns `failed`, but the runner writes that row before it appends the event. It passed 5/5 locally. The one-line test wait was reverted to keep the phase2-04 diff in budget, and the race is escalated for a parent repair (fix: `until(() => kinds(t.id, 'run.ended'), (e) => e.length > 0)`).

Parent merge-gate asked for at most 18 files (15 preferred): `ModelPolicyApi` moved from `models-catalog/model-policy-api.ts` into `models-catalog/store.ts`, and the Claude `--model` assertion moved from `packages/adapters/claude-code/src/index.test.ts` into the CAPY-337 test in `model-policy-api.test.ts`. 16 files remain.
