# UNIT 16: Captain tools: MCP endpoint, scoped run tokens, crew limits, Captain API
GOAL: Serve the five Captain tools over a Streamable HTTP MCP endpoint reachable only through the gate relay, authorised by a per-run scoped token, with kernel crew limits and the Captain REST routes.
BRANCH: flotilla/16-captain-tools   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 10 and 11 merged.
SCOPE (you own only these paths): `apps/server/src/captain/tools/**`, `apps/server/src/modules/captain-tools.module.ts` (internal `:8082` listener, not published), `apps/server/src/routes/captains.route.ts`, `packages/core/src/kernel/crewLimits.ts` + tests, `docs/runlog/16-captain-tools.md`
OUT OF SCOPE: Wake scheduling, heartbeats and the digest loop (17); hooks (P2); Captains messaging each other.
SHAPES: `Captain`, `Thread.crewOf`, `Approval`, `BudgetPolicy` scope `captain-subtree`. Tools (MCP, `@modelcontextprotocol/sdk`): `crew.start({title, brief, engine?, budget?})`, `crew.message({threadId, text})`, `crew.release({threadId})`, `digest.write({md})`, `ask.human({kind, question, options})`. Token: 32 random bytes per Captain **run**, stored hashed, expires at run end, given to the Captain container only (env + `/run/flotilla/mcp.json` pointing at `http://flotilla-tools/mcp/captain`, passed to the adapter as `mcpConfigPath`), scrubbed from events. `crewLimits.check({active, max: 5, subtreeRemaining, requested, sameProject, alreadyCrew}) → ok | KernelDenied('crew-limit')`. Routes: `POST /api/v1/captains`, `GET /api/v1/captains/:id`, `DELETE /api/v1/captains/:id/crew/:threadId` (Capy path).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/server test -- captain-tools    # in-process FakeMachineDriver; no Docker needed
```
EXPECTED: a fake-agent Captain (`--mcp-config`) calls `crew.start` 5× → 5 threads with `crewOf` set; a 6th while 5 are working → `kernel.denied`; another Captain's token → 403; no token (as a crew thread would have) → 401; the token after its run ended → 401; a crew budget above the subtree remaining is clamped or denied; a Captain-subtree budget pause makes `crew.start` fail with a `budget` Approval; `digest.write` stores `digestMd` on the captain row; `:8082` isn't bound on a published interface (compose config check).
DIFF BUDGET: ≤ 14 files / ≤ 800 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Why via the gate: thread containers have no route to the server (SPEC §6a). Crew containers can reach `flotilla-tools` too, so the per-run token is the boundary.

## Rules (hard)
- Work on branch `flotilla/16-captain-tools` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "16-captain-tools: Captain tools: MCP endpoint, scoped run tokens, crew limits, Captain API" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/16-captain-tools`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/16-captain-tools.md` DECISIONS) and anything left unverified.
