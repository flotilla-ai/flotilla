# UNIT 14: GitHub PR + CI wake + autofix loop guard
GOAL: After a turn with commits, push via the git mirror and open (or find) the PR; CI status (polling by default, webhook when a public URL exists) wakes the owning thread; autofix stops at 3 attempts or a repeated error signature and asks the human.
BRANCH: flotilla/14-github-autofix   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 09 and 11 merged.
SCOPE (you own only these paths): `apps/server/src/github/**` (client, PR ownership, check polling, log fetch), `apps/server/src/routes/github-webhook.route.ts` (public, HMAC), `apps/server/src/modules/github.module.ts` (post-turn push + PR, poller), `packages/core/src/kernel/autofix.ts` + tests, `docs/runlog/14-github-autofix.md`
OUT OF SCOPE: GitHub App install flow (fine-grained PAT from the vault in P1), reviews and conflicts (P2), re-running Actions jobs and no-CI wakes (P2), diff-oscillation guard (P2), stacked PRs (P3).
SHAPES: `Thread.prs`, `Event` kinds `pr.*`/`ci.*`, `Approval` kind `decision`. `autofixDecision(history: {attempt, signature}[], cap = 3) → 'retry' | {stop: 'cap' | 'no-progress'}`; owner = last pusher (CAPY-119).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/server test -- github
```
EXPECTED: with recorded payload fixtures and a mocked GitHub API (msw): `run.ended` with new commits → `collectAndPush` → PR opened against the project base, or the existing PR found by head branch (no duplicate on retry); thread env never has the token; polling a recorded check-runs fixture wakes the owner the same way a webhook does; failing check → log fetched, truncated to the last 200 lines, `trust: "untrusted"`; passing checks wake **once** when all checks on the head are complete and green (CAPY-037); 3 different failing signatures → 3 autofix runs then a `decision` Approval; same signature twice → stop after 2; webhook with bad HMAC → 401; push of `main` → `kernel.denied`.
DIFF BUDGET: ≤ 14 files / ≤ 800 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Polling default every 60 s per open PR with pending checks; the webhook path delivers at once (SPEC §8).

## Rules (hard)
- Work on branch `flotilla/14-github-autofix` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "14-github-autofix: GitHub PR + CI wake + autofix loop guard" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/14-github-autofix`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/14-github-autofix.md` DECISIONS) and anything left unverified.
