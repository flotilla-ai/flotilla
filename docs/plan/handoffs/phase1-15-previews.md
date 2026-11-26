# UNIT 15: Preview proxy on a separate origin (private by default)
GOAL: Expose a thread container port through the server's own reverse proxy on a **separate origin** (`:8081`, path `/p/<code>/<port>/`), dialled through the gate, gated by a preview-only token cookie (never the UI session cookie), with a signed expiring share link.
BRANCH: flotilla/15-previews   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 05, 08 and 10 merged.
SCOPE (you own only these paths): `apps/server/src/previews/**` + tests, `apps/server/src/modules/previews.module.ts` (the `:8081` listener), `apps/server/src/routes/previews.route.ts` (UI side: mint a one-time token; needs a session), `docs/runlog/15-previews.md`
OUT OF SCOPE: Caddy and wildcard preview hosts (P2), Vercel/Cloudflare preview detection (P3), keep-awake (P2).
SHAPES: `Event` kind `preview.exposed`; `exposePort(threadId, port) → {url}`; `verifyShareToken(token) → {threadId, port, exp}`; upstream connection = `CONNECT flt-<code>:<port>` to `gate:3128` with the server-only bearer (the server is not on thread networks).
DONE SIGNAL:
```
make check
FLOTILLA_DOCKER_IT=1 pnpm --filter @flotilla/server test -- previews
```
EXPECTED: a test container runs `python3 -m http.server 3000`; `curl` `:8081/p/<code>/3000/` after exchanging a one-time token for the preview cookie → 200 and the directory listing; no cookie → 401; the **UI** session cookie only → 401; the preview response never sets or forwards the UI cookie; a valid share token → 200; an expired one → 401; a preview cookie for thread A can't open thread B. If Docker is unavailable in the VM (pre-launch check P1), mark the integration test unverified and paste the unit-test output; mehdi runs it before merging.
DIFF BUDGET: ≤ 10 files / ≤ 500 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Why a separate origin: preview pages run agent-written JavaScript; on the UI origin they could act as the logged-in user (SPEC.md §6c). Strip hop-by-hop headers and any `Set-Cookie` for the UI cookie name.

## Rules (hard)
- Work on branch `flotilla/15-previews` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "15-previews: Preview proxy on a separate origin (private by default)" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/15-previews`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/15-previews.md` DECISIONS) and anything left unverified.
