# UNIT 11: Thread runner loop (container + adapter + kernel + events)
GOAL: Run a thread end to end: create → choose auth from project trust → start its container (and seed the repo) → run the adapter through the container transport → append scrubbed events → meter cost and wall clock → pause and ask on cap → resume after Approval; with queue/interrupt/stop delivery.
BRANCH: flotilla/11-thread-runner   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 02, 03, 04, 05, 09 merged.
SCOPE (you own only these paths): `apps/server/src/runner/**` + tests, `apps/server/src/routes/threads.route.ts`, `apps/server/src/modules/runner.module.ts` (10 s ticker, restart recovery), `docs/runlog/11-thread-runner.md`
OUT OF SCOPE: GitHub PR/CI (14), Captain (16/17), UI (12/13), real vendor adapters in tests (use `fake`), the gate allowlist push (10).
SHAPES: `Thread`, `Run`, `Event`, `Approval`, `CostEntry`, `Project` from `@flotilla/core/types`; kernel `meter/reserve/settle/inRunFence/checkBudget/scrub/createDeltaScrubber` by subpath; adapter host; driver + transport; `seedWorkspace`. Routes: `POST /api/v1/threads` (idempotent `requestId`), `POST /api/v1/threads/:id/message` (`{text, mode: "queue" | "interrupt"}`, default queue: delivered at turn end, CAPY-005/006), `POST /api/v1/threads/:id/interrupt`, `POST /api/v1/threads/:id/stop` (cancel without a message, cancels timers, CAPY-008), `POST /api/v1/approvals/:id/answer`. Auth choice: `vendor-login` only if the project is `trusted` **and** the run was started by the project owner; else `api-key` from the vault; neither available → blocking `credential` Approval. With `vendor-login`, call `copyCliHome` and mount only the per-thread copy.
DONE SIGNAL:
```
make check
FLOTILLA_DOCKER_IT=1 pnpm --filter @flotilla/server test -- runner
```
EXPECTED: e2e with `fake-agent --usage-usd 0.02` per step and a thread cap of $0.05: events stream in order, CostEntry rows sum to the thread total, a reservation is taken atomically in Postgres (`UPDATE … WHERE remaining >= reserve RETURNING`) before the run; at the 3rd usage the run is stopped (SIGINT first via the shim), `Run.state = paused_budget`, `Thread.status = paused`, one open blocking `budget` Approval; answering `raise` with `value: 200000` resumes with `trigger: resume`; `stop` ends it `idle`. The 10 s ticker writes `machine-estimate` CostEntries (`machineSec`) and a run past `maxWallSec` is stopped. Interrupt cancels within 10 s and leaves no process in the container; a queued message starts the next run after `done`; stop cancels without a new run. Duplicate POST with the same requestId creates one thread. Two parallel runs in one Captain subtree can't both reserve past its cap. With `fake-agent --usage-at-end`, the in-run estimate stops the run and the settled overshoot is recorded as `budget.exceeded`. An untrusted project never gets the CLI-home copy (asserted on the container inspect). A secret split across deltas is redacted in stored events.
DIFF BUDGET: ≤ 16 files / ≤ 900 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- The adapter process runs only through `driver.transport(containerId)`, never in the server process.
- The built `fake-agent` is bind-mounted read-only via `roMounts`.
- Every payload passes through `scrub()`; `agent.delta` text goes through one `createDeltaScrubber` per run before append and SSE.

## Rules (hard)
- Work on branch `flotilla/11-thread-runner` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "11-thread-runner: Thread runner loop (container + adapter + kernel + events)" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/11-thread-runner`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/11-thread-runner.md` DECISIONS) and anything left unverified.
