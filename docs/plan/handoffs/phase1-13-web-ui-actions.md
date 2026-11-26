# UNIT 13: Web UI actions: Needs-you, approvals, new thread, projects, message modes
GOAL: Add the action views as feature folders: Needs-you list with Approve / Raise / Stop, new-thread form (project, engine, budget), message box with queue / interrupt / stop, and project create with the trust toggle.
BRANCH: flotilla/13-web-ui-actions   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 11 and 12 merged.
SCOPE (you own only these paths): `apps/web/src/features/{needs-you,new-thread,thread-actions,projects}/**` + their e2e tests, `docs/runlog/13-web-ui-actions.md`
OUT OF SCOPE: Captain UI beyond listing the digest, settings pages, multi-user.
SHAPES: `Approval`, `Project`, `Thread` from `@flotilla/core/types`; routes from units 08 and 11.
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/web build && pnpm --filter @flotilla/web test:e2e -- features
```
EXPECTED: e2e against a fake-backed server: an open budget Approval appears in orange in Needs-you; `Raise` to $0.20 sends `{optionId:"raise", value:200000}`; `Stop` sends `{optionId:"stop"}` (requests captured); new thread with engine `fake` and budget $0.05 streams events; sending with Interrupt calls `/interrupt` then `/message`; a new project shows "untrusted" and switching to trusted requires the typed confirmation. Attach one screenshot.
DIFF BUDGET: ≤ 16 files / ≤ 800 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Same design rules as unit 12. Explain "untrusted" in one plain line: "runs with an API key; your Claude/Codex login is never mounted".

## Rules (hard)
- Work on branch `flotilla/13-web-ui-actions` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "13-web-ui-actions: Web UI actions: Needs-you, approvals, new thread, projects, message modes" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/13-web-ui-actions`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/13-web-ui-actions.md` DECISIONS) and anything left unverified.
