# UNIT 07: codex adapter (official CLI, fixture-tested)
GOAL: Drive the official `codex exec --json` and `codex exec resume <SESSION_ID>`, map the JSONL stream to AdapterEvents incl. token usage.
BRANCH: flotilla/07-codex-adapter   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 04 merged; pre-launch check P3 (Codex flags/env/JSONL) recorded if mehdi ran it.
SCOPE (you own only these paths): `packages/adapters/codex/**`, `docs/runlog/07-codex-adapter.md`
OUT OF SCOPE: `codex app-server` mode (P2), reading Codex `auth.json`, live API calls.
SHAPES: SPEC §5a/§5b. Manifest: transport `stdout-jsonl`, `costReporting: 'tokens'`, `vendorBudgetFlag: null`, `hardCapSupported: false` (usage only at turn end, no vendor fence: UI labels the cap "soft"), auth `[{kind:'vendor-login',command:['codex','login']},{kind:'api-key',envVar:<from P3 or docs>}]`, `egressHosts` (unverified unless P3 ran).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/adapter-codex test
```
EXPECTED: start argv = `codex exec --json <prompt>` (+ model flags when set); resume argv = `codex exec resume <id> ...`; fixture parsing yields `session`, text/tool events, `usage` with token counts, `done`. Source never references `auth.json` and never imports `child_process`.
DIFF BUDGET: ≤ 8 files / ≤ 450 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Docs: https://developers.openai.com/codex/noninteractive. Exact JSONL event/field names and the API-key env var (`CODEX_API_KEY` vs `OPENAI_API_KEY`) are unverified (SPEC.md §15 "Still open" item 4): read the docs, record or hand-write fixtures, and list every field name you relied on in the runlog as verified/unverified.

## Rules (hard)
- Work on branch `flotilla/07-codex-adapter` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "07-codex-adapter: codex adapter (official CLI, fixture-tested)" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/07-codex-adapter`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/07-codex-adapter.md` DECISIONS) and anything left unverified.
