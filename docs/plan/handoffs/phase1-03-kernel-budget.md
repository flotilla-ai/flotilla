# UNIT 03: Kernel: budget meter, reservations, caps, secret scrubber, branch guard
GOAL: Pure kernel functions that turn usage into CostEntry rows, reserve and settle budget, stop runs on in-run fences (cost, tokens, wall clock), enforce thread and Captain-subtree caps (pause-and-ask), scrub secrets from payloads and streamed deltas, and refuse protected-branch pushes.
BRANCH: flotilla/03-kernel-budget   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 01 merged.
SCOPE (you own only these paths): `packages/core/src/kernel/{budget.ts,scrub.ts,branchGuard.ts,priceTable.ts}` + their tests, `packages/core/price-table.json`, `docs/runlog/03-kernel-budget.md`
OUT OF SCOPE: Any I/O, DB, process control. The runner (11) calls these functions. No `kernel/index.ts`: importers use subpaths (`@flotilla/core/kernel/budget`).
SHAPES: `BudgetPolicy`, `BudgetState`, `Hold`, `CostTotals`, `CostEntry`, `Approval`, `AdapterEvent`, `KernelDenied` from `@flotilla/core/types`. Functions:
- `meter(ctx: {threadId, runId, at}, prev: CostTotals, usage: Extract<AdapterEvent,{t:'usage'}>, model, priceTable) → { entry: CostEntry; next: CostTotals }` (vendor `usdMicro` wins, else tokens × price; `source` set accordingly; `cumulative: true` usage is turned into a delta against `prev`)
- `reserve(tree: BudgetState[], perRunReserve: MicroUsd, ctx: {threadId, captainId, runId}) → { ok: true; holds: Hold[] } | { ok: false; scope; approval: Omit<Approval,'id'> }` and `settle(holds, actual: CostTotals) → { overshoot: MicroUsd }`: pure versions of SPEC.md §13 (the runner does the atomic DB update). The approval takes `threadId`/`captainId` from `ctx`.
- `inRunFence({estimate: CostTotals, wallSec, hold, policy}) → 'continue' | {stop: 'usd'|'tokens'|'wall'}`
- `checkBudget(tree: BudgetState[], ctx) → { action: 'ok' } | { action: 'warn'; scope } | { action: 'pause'; scope; approval: Omit<Approval,'id'> }`; budget approvals have exactly the options `raise` (answer.value = new cap, micro-USD) and `stop`
- `scrub(payload: unknown, secrets: Record<string, string>) → unknown`: known values ≥ 8 chars, exact, URL-encoded, and base64 at all three byte offsets → `[REDACTED:<name>]`; **pattern rules** for formats the server can't know (`sk-ant-`, `sk-proj-`, `sk-`, `ghp_`, `gho_`, `github_pat_`, `AKIA[0-9A-Z]{16}`, JWT-shaped, `-----BEGIN … PRIVATE KEY-----` blocks) → `[REDACTED:pattern]`
- `createDeltaScrubber(secrets) → { push(chunk: string): string; flush(): string }`: holds back the last (longest secret or pattern − 1) chars so a secret split across `agent.delta` chunks is still redacted before it is stored or streamed
- `assertPushAllowed(branch, {baseBranch, defaultBranch}) → void` or throws `KernelDenied('protected-branch', …)` (deny base/default, main, master, develop, release/*; allow only `flotilla/*`)
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/core test -- kernel
```
EXPECTED: table-driven tests pass for: warn at 80%, pause at 100% with a blocking `budget` Approval whose options are exactly `raise` and `stop`; Captain-subtree cap trips even when each thread is under its own cap; micro-USD integer math (no floats in totals; a `usdMicro` of 20000 = $0.02); cumulative usage counted once; `reserve` fails when two parallel holds would together exceed the Captain subtree; `settle` reports overshoot; `inRunFence` stops on `maxWallSec`; scrub catches plain/urlencoded/base64 at offsets 0, 1 and 2, names the secret, and redacts a fake `sk-ant-` token it wasn't given; a secret split across 3 delta chunks never appears in the concatenated output; push to `release/1.2` denied, to `flotilla/x` allowed.
DIFF BUDGET: ≤ 12 files / ≤ 750 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Money is integer micro-USD (SPEC §4). Adapters convert vendor dollars at the boundary; the kernel never sees a float dollar.
- `price-table.json` ships with **placeholder** prices marked `"unverified": true`; do not invent real vendor prices.

## Rules (hard)
- Work on branch `flotilla/03-kernel-budget` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "03-kernel-budget: Kernel: budget meter, reservations, caps, secret scrubber, branch guard" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/03-kernel-budget`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/03-kernel-budget.md` DECISIONS) and anything left unverified.
