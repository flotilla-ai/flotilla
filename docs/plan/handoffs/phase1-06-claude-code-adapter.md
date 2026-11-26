# UNIT 06: claude-code adapter (official CLI, fixture-tested)
GOAL: Drive the official `claude` CLI headless, map its stream to AdapterEvents incl. mid-turn and final cost, with argv that depends on the auth mode, without ever reading or storing Claude credentials.
BRANCH: flotilla/06-claude-code-adapter   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 04 merged, and pre-launch check P2 (Claude OAuth smoke test, handoffs/README.md) recorded in `docs/runlog/prelaunch.md`.
SCOPE (you own only these paths): `packages/adapters/claude-code/**` (manifest, argv builder, line parser, fixtures, tests), `docs/runlog/06-claude-code-adapter.md`
OUT OF SCOPE: Any login flow, reading `~/.claude*`, the Claude Agent SDK, live API calls in tests.
SHAPES: SPEC §5a/§5b. Manifest: transport `stdout-jsonl`, `costReporting: 'usd'`, capabilities `vendorBudgetFlag: '--max-budget-usd'`, `hardCapSupported: true`, auth `[{kind:'vendor-login',command:['claude','auth','login']},{kind:'api-key',envVar:'ANTHROPIC_API_KEY'}]`, `egressHosts` from the P2 check (mark unverified if it wasn't run).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/adapter-claude-code test
```
EXPECTED: argv for start contains `-p`, `--output-format`, `stream-json`, `--verbose`; `--max-budget-usd 0.05` when `vendorBudget.maxMicroUsd` is 50000 (dollars formatted only here); `--bare` **iff** `input.auth === 'api-key'`; with `vendor-login` it instead contains `--strict-mcp-config --setting-sources user` (keep these behind one constant, per the P2 check result); `--mcp-config <path>` (plus `--strict-mcp-config`) iff `mcpConfigPath` is set; resume argv contains `--resume <id>`. Parsing `fixtures/*.jsonl` yields `session`, text/tool events, per-assistant-message `usage` (`cumulative: false`, tokens) **when the fixture's assistant lines carry usage**, one final `usage` with `usdMicro = round(total_cost_usd × 1e6)` and `cumulative: true`, then `done`; a fixture of a SIGTERM-killed run (no result line) yields `done:cancelled` with no final usage (the runner falls back to its estimate). A test asserts the adapter source never references `.claude.json`, `.credentials`, or `setup-token`, and never imports `child_process`.
DIFF BUDGET: ≤ 8 files / ≤ 550 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Docs: https://code.claude.com/docs/en/headless (stream-json, --resume, --bare, total_cost_usd, --max-budget-usd) and https://code.claude.com/docs/en/cli-reference (`--strict-mcp-config`, `--setting-sources`, `--mcp-config`). Terms: https://code.claude.com/docs/en/legal-and-compliance.
- Decided (mehdi, SPEC §6a): untrusted projects run with an API key and `--bare`; trusted projects may use the user's login, copied per thread. Choosing the mode and mounting is the runner's job (unit 11), not this adapter.
- Fixtures: prefer the real recording from the P2 smoke test (scrub it). Otherwise hand-write from the documented schema, mark `"synthetic": true`, and list unverified field names (incl. the session-id field and mid-turn usage) in the runlog.

## Rules (hard)
- Work on branch `flotilla/06-claude-code-adapter` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "06-claude-code-adapter: claude-code adapter (official CLI, fixture-tested)" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/06-claude-code-adapter`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/06-claude-code-adapter.md` DECISIONS) and anything left unverified.
