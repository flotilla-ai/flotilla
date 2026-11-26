# UNIT 10: Egress gate: per-thread allowlist proxy and internal tools relay
GOAL: Replace the unit 01 gate stub with the real egress gate from SPEC §6a, plus the server-side client that tells the gate each thread network's allowlist.
BRANCH: flotilla/10-egress-gate   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 05 merged.
SCOPE (you own only these paths): `apps/gate/**` (takes over the stub from unit 01), `apps/server/src/gateClient/**`, `apps/server/src/modules/gate.module.ts`, tests, `docs/runlog/10-egress-gate.md`
OUT OF SCOPE: TLS interception (never), per-request content inspection, Caddy (P2), BYO runner egress (P2).
SHAPES: Gate listeners: `:3128` forward proxy (`CONNECT host:443`, plain `http://` GET/POST); `:80` relay answering only `Host: flotilla-tools` and only path prefix `/mcp/captain`, forwarded to `server:8082`; `:3129` admin on the `edge` network only, bearer from `/run/flotilla-gate/token` (read-only volume; the server writes it on first start, SPEC §11): `PUT /networks/:name {allow: string[]}` / `DELETE /networks/:name`. Rules: a client is identified by the gate interface its packet arrived on (one interface per `flt-<threadId>` network); `CONNECT` allowed only to allowlisted names (exact or `*.suffix`) whose **resolved** IPs are all public (deny RFC1918, loopback, link-local incl. 169.254.169.254, 100.64.0.0/10, ULA, multicast, and the gate's own subnets); `CONNECT flt-<code>:<port>` only from the `edge` network with the bearer (previews, unit 15). Server side: `gate.module.ts` pushes `adapter.egressHosts ∪ project.egressAllow` when a thread container starts and deletes it when it stops.
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/gate test && FLOTILLA_DOCKER_IT=1 pnpm --filter @flotilla/server test -- gate
```
EXPECTED: unit tests with an injected resolver: allowlisted host with a public IP → tunnel opened; allowlisted host resolving to 10.0.0.5 or 169.254.169.254 → 403; non-allowlisted host → 403; `CONNECT flt-x:3000` from a thread interface → 403, from edge without bearer → 403, with bearer → allowed; `flotilla-tools` relay forwards `/mcp/captain` and returns 404 for any other path; admin API without bearer → 401; every decision logged as one line (host, verdict) with no payload. Integration: a thread container with `curl https://<allowlisted>` via proxy succeeds (mark unverified if the VM has no internet) and `curl https://example.org` (not listed) fails. If Docker is unavailable in the VM (pre-launch check P1), mark the integration test unverified and paste the unit-test output; mehdi runs it before merging.
DIFF BUDGET: ≤ 14 files / ≤ 750 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Use Node's `http`/`net` only (no proxy dependency needed); resolve DNS once and connect to the checked IP to avoid DNS-rebinding.
- Decided by mehdi (SPEC §6a): P1 gets a basic egress allowlist so a leaked token or repo hook can't send data anywhere it likes.

## Rules (hard)
- Work on branch `flotilla/10-egress-gate` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "10-egress-gate: Egress gate: per-thread allowlist proxy and internal tools relay" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/10-egress-gate`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/10-egress-gate.md` DECISIONS) and anything left unverified.
