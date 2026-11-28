# DEVIN-PR-DEVIN-CLI.md: one small PR that adds an optional Devin CLI adapter

Written Nov 28, 2026 (PKT). Executor: Devin on SWE 2.1 Max. One PR into `flotilla/p1`. Independent of the unblock run and the Captain run: it only adds a new package plus two flag-gated registration lines, so it can't break or block anything.

---

## For mehdi (read this; do not paste this section)

1. **What it does:** lets Flotilla run the official `devin` CLI inside a thread, signed in with **your own** Devin account through Devin's own login (`devin auth login`). It's **off by default**. It only turns on when the server has `FLOTILLA_ADAPTER_DEVIN_CLI=1`. Tests use a fake `devin` script, so CI needs no Devin account.
2. **Where to paste:** a **new** Devin session on SWE 2.1 Max. It can run alongside the unblock run, because it touches no file that run owns. Paste only the text between the `=======` lines. Attach nothing.
3. **Free usage, honestly (measured from Devin's model docs, https://docs.devin.ai/desktop/models, read Nov 28):**
   - SWE-2.1 is free for self-serve plans in Devin Desktop and Devin CLI **through Dec 8, 2026 (Pacific)**. From Dec 9 to Jan 30, 2027 it costs $0.50 / $2.50 per million input/output tokens, then list price.
   - SWE-2 is free in Desktop/CLI only **through Nov 30, 2026 (Pacific)**.
   - **Not free:** SWE-2.1 Ultrafast, and anything that runs in Devin Cloud (`--cloud`, `/handoff`).
   - So after Dec 8 this adapter **will use your paid quota**. The adapter refuses `--cloud` and Ultrafast and pins the model you pick, but it can't make a model free.
4. **Terms risk you should decide on (measured, https://cognition.com/legal/platform-terms-of-service §2):**
   - The grant is for "internal business purposes only".
   - Use restriction (iii): you may not "use the Services to create or develop any competing products or services". Flotilla is an agent orchestrator, which overlaps with what Devin sells. Driving Devin from Flotilla, and also using Devin to build Flotilla, could be read as falling under that clause. I'm not a lawyer. The stated consequence is that Cognition may suspend access without notice (§7.2).
   - Use restriction (iv): don't make the service available to anyone who isn't an Authorized User. So the adapter only runs Devin for **its owner's own threads**, never for shared Captains, teammates, or automations someone else started.
   - Headless/scripted use itself is documented and supported: `devin -p` is described "for scripts and CI" (https://github.com/CognitionAI/devin-cli, https://docs.devin.ai/cli/reference/commands).
5. **After it merges, to use it live:**
   - Build the optional image (`docker build -f deploy/thread-devin.Dockerfile ...`, the command will be in the PR).
   - Set `FLOTILLA_ADAPTER_DEVIN_CLI=1` and mark the project trusted.
   - Open a thread's shell and run `devin auth login --force-manual-token-flow` once, inside the sandbox. The CLI keeps its own token there. Flotilla never reads it.
   - Pick the model `swe-2.1` (or `swe`).

---

======= PASTE INTO DEVIN (from the next line through the matching end line) =======

You are Devin, adding ONE small, isolated PR to Flotilla for mehdi. Repo `flotilla-ai/flotilla`, base branch `flotilla/p1`. Nobody is awake; never ask; never wait.

## Goal
Add an optional adapter that runs the official, unmodified Devin CLI (`devin`, npm package `devin`, currently 3000.15.14) in a Flotilla thread container, signed in with the thread owner's own account via the CLI's own login. It is OFF by default and gated by the server env var `FLOTILLA_ADAPTER_DEVIN_CLI=1`. With the flag unset, Flotilla behaves exactly as before (prove it with a test).

## Hard rules
1. One branch `flotilla/devin-cli-adapter` from current `flotilla/p1`; one PR into `flotilla/p1` titled `devin-cli: optional Devin CLI adapter (off by default)`; squash-merge only after `make check` passes. Never touch `main`, never force-push, never deploy, never create repos or issues, never message anyone. If another run merges into `flotilla/p1` meanwhile, merge `flotilla/p1` into your branch (no rebase/force-push) and re-run checks.
2. No changes to shared interfaces: do not edit `packages/core` (the `AdapterId` union already contains `"devin"`; `AuthMethod` already has `vendor-login`), `packages/adapters/host`, other adapters, `deploy/thread.Dockerfile`, `docker-compose.yml`, the runner, the machine driver, migrations, `docs/plan/PARITY.md` or `docs/plan/PROGRESS.md`. Allowed edits outside the new package: exactly the conditional registration in `apps/server/src/routes/threads.route.ts` and `apps/server/src/models-catalog/store.ts` (append the Devin adapter/manifest only when the flag is `1`), the server `package.json` dependency line, `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md`, `docs/plan/DECISIONS-LOG.md` (append), a new `deploy/thread-devin.Dockerfile`, a new `docs/adapters/devin-cli.md`, and `docs/runlog/devin-cli.md`.
3. Never store, read, copy, log or proxy Devin credentials. The adapter source must not reference `credentials.toml`, `DEVIN_API_KEY`, `WINDSURF_API_KEY`, `.local/share/devin` reads, or `child_process` (add a test like the codex adapter's "never references auth.json or child_process"). The CLI keeps its own token inside the thread sandbox; Flotilla only runs the binary. No secrets in code, logs, fixtures or `.env.example`.
4. Never spend cloud or premium quota by construction: never pass `--cloud`, never use `/handoff`, `devin cloud`, `devin ssh` or `devin acp`. Reject (as a `done` with `stopReason: 'error'` and a clear message, before spawning) any model name matching `/ultrafast/i`. Strip `DEVIN_REFUSAL_FALLBACK` and `DEVIN_MODEL` from the env you pass, so the CLI can't silently switch to another (possibly paid) model; always pass the chosen model explicitly with `--model` (default `swe` when none is set).
5. Tests use a fake `devin` script only. No real Devin account, no network, no paid calls, no Ollama.
6. Label claims measured/inferred/guess in the PR body; mark anything you could not run `unverified` and say why. 3 attempts max; if still failing, open the PR as draft with the failure and stop.

## Build (mirror `packages/adapters/codex` and `packages/adapters/generic-cli`)
- New package `packages/adapters/devin-cli` named `@flotilla/adapter-devin-cli`: same `package.json`/`tsconfig` shape as `adapter-codex`, deps `@flotilla/core` and `@flotilla/adapter-host` only.
- `src/index.ts` exports `argvFor`, `parseDevinLine`, `DevinCliAdapter`, `devinCliAdapter`.
- Manifest:
  - `id: 'devin'`, `displayName: 'Devin CLI'`, `binary: 'devin'`, `versionRange: '3000.x (unverified)'`, `transport: 'stdout-jsonl'` (we read stdout lines as text).
  - `capabilities`: resume false, cancel true, steerMidTurn false, nativeSubagents false, vendorBudgetFlag null, hardCapSupported false, mcp false, images false, planMode false, permissionModes `[]`.
  - `auth: [{ kind: 'vendor-login', command: ['devin','auth','login','--force-manual-token-flow'] }]`, `costReporting: 'none'`.
  - `egressHosts`: list what the docs show for login and model traffic, mark them `unverified` in a code comment, and never widen the gate default.
- `argvFor(input)` returns `['devin', '--print', '--respect-workspace-trust', 'false', '--permission-mode', 'dangerous', '--model', <model>, '--', input.prompt]`. Docs: `--print` is non-interactive, it fails in an untrusted directory without `--respect-workspace-trust false`, and `--` separates the prompt (https://docs.devin.ai/cli/reference/commands). `dangerous` (bypass) is acceptable ONLY because Flotilla's container is the sandbox (cap-drop ALL, egress gate); explain that in `docs/adapters/devin-cli.md` and log it in DECISIONS-LOG.md (question, options: `normal`/`accept-edits` hang in print mode waiting for approvals, `autonomous` needs `--sandbox`/bwrap which our hardened container can't run; choice; how to undo).
- `start()`: refuse the Ultrafast model (rule 4), build an env without the stripped vars, run through `runJsonl(input.transport, argv, ...)` with each stdout line mapped to `{ t: 'text', delta: line + '\n' }`, then wrap the iterable so that if the process ended without a `done`, you yield `{ t: 'done', stopReason: 'end_turn' }` (runJsonl only emits `done` for cancel or non-zero exit; check `packages/adapters/host/src/index.ts`). Map a line containing `Quota exhausted` or `Usage limit reached` (strings named in the Devin CLI changelog, https://docs.devin.ai/cli/changelog/stable) to `{ t: 'done', stopReason: 'error', error: 'devin: usage limit reached' }`.
- `resume()` calls `start()` (no resume in v1; `--resume <id>` and `--export` ATIF parsing are listed as follow-ups in the doc). `cancel()` mirrors codex (process-group signal through the run's cancel).
- `probe()` runs `devin --version` and reports installed/version, `authed: 'unknown'`.
- Login location: the CLI stores its token under `$XDG_DATA_HOME/devin/credentials.toml` (https://docs.devin.ai/cli/enterprise/devin-auth). Do not mount anything new. In the adapter's env set `XDG_DATA_HOME=/home/node/.claude/.devin-xdg` so the CLI's own token lives inside the existing per-user vendor-login volume that Flotilla already mounts for trusted projects (and never on untrusted projects). Document this in `docs/adapters/devin-cli.md` and DECISIONS-LOG.md as a reversible choice (undo: give Devin its own volume in a later PR that may change the driver).
- Registration: in `threads.route.ts` and `models-catalog/store.ts`, add the adapter/manifest only when `process.env.FLOTILLA_ADAPTER_DEVIN_CLI === '1'`. Nothing else in the server changes.
- `deploy/thread-devin.Dockerfile`: `ARG BASE=flotilla-thread:p1-fix02`, `FROM ${BASE}`, then as root `npm install -g devin@3000.15.14 && npm cache clean --force`, back to `USER node`. Not referenced by compose or `make verify`. Never run `curl | bash` installers. Record in `THIRD_PARTY_NOTICES.md`: Devin CLI, proprietary ("SEE LICENSE IN https://cognition.ai/terms-of-service"), optional external binary in an optional image, not a dependency of core.
- `bin/fake-devin` (node script used only by tests): `--version` prints `devin 3000.15.14`; otherwise records argv as JSON to `$FAKE_DEVIN_ARGV` if set, prints scripted lines from `$FAKE_DEVIN_SCRIPT` (or two default lines), honors `FAKE_DEVIN_EXIT`, `FAKE_DEVIN_QUOTA=1` (prints `Quota exhausted`), and `FAKE_DEVIN_HANG=1` (ignores SIGTERM and spawns a child, to prove group cancel).

## Tests (`src/index.test.ts`, vitest, using `LocalTransport` from `@flotilla/adapter-host` and PATH pointing at `bin/`)
1. `argvFor` exact shape, with and without a model (default `swe`); never contains `--cloud`, `acp` or `cloud`.
2. A full start against fake-devin yields text deltas then `done end_turn`; argv recorded by the fake matches `argvFor`.
3. Env passed to the CLI has no `DEVIN_REFUSAL_FALLBACK`/`DEVIN_MODEL` and sets `XDG_DATA_HOME` as above.
4. A model `swe-2.1-ultrafast` is refused before any spawn (fake's argv file not written).
5. Non-zero exit → `done error`; `FAKE_DEVIN_QUOTA=1` → `done error` with the usage-limit message.
6. Cancel on `FAKE_DEVIN_HANG=1` ends the run with `done cancelled` and no surviving process group.
7. `probe()` parses the version.
8. Source never references `credentials.toml`, `DEVIN_API_KEY`, `WINDSURF_API_KEY` or `child_process`.
9. Server: with the flag unset, the adapters map and catalog manifests are unchanged (no `devin`); with `FLOTILLA_ADAPTER_DEVIN_CLI=1`, `devin` is present. Put this test in the new package or a new server test file; do not edit existing tests.

## Done
`pnpm --filter @flotilla/adapter-devin-cli test`, `pnpm -r typecheck` and `make check` pass. The PR body has the diff stat, pasted real test output, measured/inferred labels, the free-window dates above as context (no claims about live behavior), and an `unverified` list: real login, real model output format, real egress hosts, real exit codes, behavior after the free window ends. Write `docs/runlog/devin-cli.md` with the same content and the live-check commands for mehdi. Squash-merge into `flotilla/p1`, then stop.

======= END PASTE =======
