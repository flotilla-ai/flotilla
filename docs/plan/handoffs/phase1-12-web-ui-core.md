# UNIT 12: Web UI core: login, thread list, live thread view, cost meter
GOAL: A React + Vite SPA served by the server with the setup/login screens, the thread list, a live thread view over SSE, and the cost meter in the thread header; plus the feature-folder extension point unit 13 plugs into.
BRANCH: flotilla/12-web-ui-core   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 02 and 08 merged.
SCOPE (you own only these paths): `apps/web/**` except `apps/web/src/features/**` (unit 13), `apps/server/src/routes/static.route.ts` (serves the built SPA, public), `docs/runlog/12-web-ui-core.md`
OUT OF SCOPE: Approvals/Needs-you, new-thread and project forms (13), Captain UI, settings, mobile layout.
SHAPES: `Thread`, `Event`, `CostTotals` from `@flotilla/core/types` (import, don't redefine). Package `@flotilla/web`; Playwright and React deps only here. Extension point: the router auto-registers every `src/features/*/index.tsx` via `import.meta.glob` (each exports `{ path, element, nav? }`); ship one example feature folder only in tests.
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/web build && pnpm --filter @flotilla/web test:e2e   # Playwright, against a server seeded with fake events
```
EXPECTED: e2e: setup with the printed token, log in; 3 seeded events render in order, a 4th pushed live appears without reload, the header cost meter shows the seeded total and labels a `hardCapSupported: false` engine's cap "soft"; logged out → redirected to login. Attach one screenshot to the runlog.
DIFF BUDGET: ≤ 22 files / ≤ 1,000 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Design taste (BOT-BRIEF.md): greys and black, orange only for "needs you"; no pill badges; no dot-matrix numerals; no grey second line in a hero title.
- Send `X-Flotilla-CSRF` on every non-GET (unit 08).
- Playwright is Apache-2.0.

## Rules (hard)
- Work on branch `flotilla/12-web-ui-core` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "12-web-ui-core: Web UI core: login, thread list, live thread view, cost meter" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/12-web-ui-core`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/12-web-ui-core.md` DECISIONS) and anything left unverified.
