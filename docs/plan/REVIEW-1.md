# REVIEW-1: hard review of the Flotilla plan before phase1-01

Written Nov 27, 2026 (PKT). Reviewed: `SPEC.md`, `ROADMAP.md`, `research/BASE.md`, `handoffs/*.md`, `scripts/gen_parity.py`, against `research/CAPY.md` §15 and `BOT-BRIEF.md`. The stance was "the plan is wrong until shown otherwise".

**Method.** The `interrogate` skill asks for parallel reviewers. No fan-out tool was available in this run, so every probe ran directly, with evidence:
- Doc probes: Claude Code headless docs on `--bare` and SIGTERM vs SIGINT.
- `tsc --strict --noEmit` over every SPEC TS block. It failed before the fixes and passes now.
- `gen_parity.py` re-run from another cwd.
- `rg` sweeps for stale Caddy, `--bare` and local-path references.

Backups of the pre-review files are in `/tmp/*.before*`. They are lost when the box is replaced.

**Totals: 5 blockers, 12 majors, 17 minors.** 28 are fixed in the files, 2 are fixed in part (M2, M11), and 4 are not fixed (M3, M9, M10, m13). Three of the unfixed ones need mehdi's call.

## Blockers

| # | Where | Problem | Status |
|---|---|---|---|
| B1 | SPEC §5b, handoffs/phase1-06 | The Claude adapter always passed `--bare`. The docs say bare mode never reads OAuth/subscription login and needs `ANTHROPIC_API_KEY`/apiKeyHelper. So the decided per-user login volume could never work. | **Fixed.** `--bare` is passed iff auth is `api-key`. The unit 06 done-check asserts both cases. The side effect is recorded as M3. |
| B2 | SPEC §13, handoffs/phase1-10 | The server pushed with its GitHub token from the agent-controlled worktree. The agent can plant `.git/hooks/pre-push`, `core.sshCommand` or `credential.helper`, which then run on the server with the token: token theft or RCE. | **Fixed.** The server pulls a `git bundle` into its own bare mirror and pushes with `core.hooksPath=/dev/null`, accepting only `flotilla/*` refs. Unit 10 has a test that plants a hook and proves it doesn't run. |
| B3 | SPEC §6c, handoffs/phase1-11, ROADMAP | The preview fallback `/preview/<code>/<port>/` sat on the UI origin behind the UI session cookie. Agent-written JS in a preview could then drive the control plane as the logged-in user. Wildcard subdomains under the UI domain had the same cookie-scope problem. | **Fixed.** P1 previews use the server's own proxy on a separate origin (`:8081`) with a preview-only cookie swapped from a one-time token. The UI cookie is rejected there. P2 adds a Caddy wildcard on a separate `FLOTILLA_PREVIEW_DOMAIN`. Caddy is gone from P1. |
| B4 | SPEC §13, handoffs/phase1-03 and 08 | The "hard cap pauses and asks" claim was racy. Claude reports cost only in the final result, and SIGTERM produces no result at all. Parallel crew each checked "under cap" and overspent together. Devin ACUs lag. | **Fixed (bounded, not eliminated).** Changes: atomic reservations across the budget tree (`UPDATE … WHERE remaining >= reserve RETURNING`); a vendor fence (`--max-budget-usd`); a streaming estimate; `maxWallSec`; SIGINT before SIGTERM; settle afterwards, with overshoot recorded. Run state `paused_budget`, thread `paused`. Overshoot of up to about one turn remains and is disclosed as ROADMAP risk 5. |
| B5 | handoffs/README checklist | The checklist said to create the repo, then a protected `flotilla/p1`. A branch can't exist in an empty repo, so unit 01's first push target would be missing. | **Fixed.** Step 1 now creates the repo with an initial commit (README + MIT LICENSE). |

## Majors

| # | Where | Problem | Status |
|---|---|---|---|
| M1 | SPEC §12 | Hooks could absorb `budget.*` wakes or reclassify kernel Approvals, so a bad hook edit could silence the cap. Hook "no network" was only a promise. | **Fixed.** Kernel-originated items bypass hooks. The hook runner is a container with `--network none`. |
| M2 | SPEC §13, handoffs/phase1-03 | The scrubber only redacts secrets the server knows. The server never reads the Claude login volume, so those tokens can't be scrubbed by value. | **Partly fixed.** Pattern rules cover `sk-ant-`, `ghp_`, `github_pat_`, JWT and PEM, plus server logs. Unknown formats stay a residual risk. |
| M3 | SPEC §5b and §13, ROADMAP risk 6 | Without `--bare`, Claude loads the repo's own `.claude` hooks, settings and `.mcp.json`. An untrusted repo can then run code next to the mounted login volume and exfiltrate it. P1 has no egress allowlist. | **Not fixed. mehdi's call.** Options: (a) accept for P1 and use API-key mode for untrusted repos (current text); (b) pull a basic egress allowlist into P1 (adds a proxy, roughly one more unit); (c) P1 supports API-key mode only. |
| M4 | SPEC §13 | BYO os-user isolation: the same-uid agent, shared `/tmp`, and readable home dirs let an agent escape its scope. | **Fixed in spec** (new row; mitigations are P2 with the runner). Not in P1 code, because BYO is P2. |
| M5 | handoffs/README | The checklist said "put this tree on it". That would publish full third-party clones (`research/t3code` has trademark rules), scraped Capy docs dumps, the Devin docs dump and the private `BOT-BRIEF.md` in a public repo. | **Fixed.** There's an explicit allowlist of plan files. Handoffs now link to pinned upstream commits instead of `research/` clone paths (units 02, 04, 12). |
| M6 | handoffs/phase1-08 | The e2e test ran `fake-agent` inside the thread container, but nothing put it there. | **Fixed.** Unit 05 adds read-only extra mounts, and unit 08 bind-mounts the built fake-agent. |
| M7 | handoffs/phase1-05 | No unit installed the official `claude`/`codex` CLIs in the thread image, so the P1 demo's "claude-code (manual run)" had no binary. Publishing an image with them is a redistribution question. | **Fixed.** Build args install pinned CLIs at local build time, and the image is never published. The official package names and install methods are **unverified**; unit 05 must cite the vendor docs. |
| M8 | handoffs/phase1-12 | The Captain tool transport was "MCP server or tool shim" (undecided). The test needed Docker for no reason. The test contradicted itself: it started 3 crew, then said "6th concurrent". | **Fixed.** `POST /captain-tools/:name` with a per-Captain bearer token, scrubbed from events. Fake-agent makes the calls. FakeMachineDriver, so no Docker. Starts 5, then the 6th is denied, and another Captain's token gets 403. |
| M9 | SPEC §2 and Appendix A | 465 of 639 parity rows map to a generic area equivalent ("GitHub integration + …"). That's parity in name, not in design. | **Not fixed (noted in §2).** Writing 465 bespoke rows now would mostly be P2+ guesswork. Proposal: refine each phase's rows when writing that phase's handoffs. |
| M10 | SPEC §15, BASE | Whether Anthropic's terms allow running the official CLI with a user's own subscription login on a host volume is **unverified**. | **Not fixed. mehdi's call** (already a decided, accepted risk). It needs a human read of the current terms, or asking Anthropic. |
| M11 | DEVIN-PLAYBOOK §7.7, handoffs 05/08/11 | Docker inside the Devin VM is untested, and three units need it for integration tests. | **Partly fixed.** Unit 01 probes Docker first. Docker tests are behind `FLOTILLA_DOCKER_IT=1` and are reported as unverified when skipped. If Devin has no Docker, those tests must run elsewhere (mehdi's laptop or another runner). |
| M12 | SPEC §5b | The plan assumed Claude streams per-message usage, which would have made a token-level live meter possible. That's unverified. | **Fixed.** Marked unverified. `--max-budget-usd` is the main in-turn fence, and the estimate covers the rest. |

## Minors

| # | Where | Problem | Status |
|---|---|---|---|
| m1 | Appendix A, CAPY-486 | Regional expansion of ad-funded free models was P2. It's the same business deal as CAPY-320. | **Fixed**: n/a. |
| m2 | Appendix A, CAPY-350 | Personal/Team workspace type was n/a, but it maps to single-user vs org. | **Fixed**: P3. |
| m3 | Appendix A, CAPY-222 | Previews were "public while awake" in P2, which contradicts private-by-default in P1. | **Fixed**: P1, inverted. Counts are now P1 52, P2 370, P3 175, P4 21, n/a 21. |
| m4 | handoffs/phase1-01, SPEC §14, BASE | Over-engineering: `pg-boss`, Caddy and `@playwright/test` were pre-added to the P1 skeleton. | **Fixed.** P1 uses in-process timers on Postgres rows. pg-boss and Caddy move to P2. Playwright stays in web (unit 09). |
| m5 | handoffs/phase1-01 | Pushing `.github/workflows/*` needs the GitHub app's workflows permission. | **Fixed**: a note in unit 01 and the README. |
| m6 | handoffs/phase1-01, SPEC §11 | The Postgres password was implied in compose, and `.env` was required. | **Fixed**: internal network plus a generated secret or trust. Nothing is committed. |
| m7 | handoffs/phase1-10, ROADMAP | Webhook-only CI wake needs a public URL, which a laptop install doesn't have. Reviews and conflicts were in P1 scope. | **Fixed**: polling by default, webhook optional, with a test for each. Reviews and conflicts move to P2. |
| m8 | SPEC §4 | Approval answer options differed between SPEC and unit 03. There was no numeric value for "raise to $X". | **Fixed**: `raise | stop` plus `value?`. |
| m9 | SPEC §4-5, §12 | Type holes: `MachineCtx`, `WakeInput`, `WakeDecision`, `CrewRequest`, `EngineChoice`, `DigestState`, `CiFailure` and `CrewResult` were undefined. | **Fixed**: added the definitions. `tsc --strict` passes over all SPEC blocks. |
| m10 | SPEC §4 | ID prefix text vs type (`thr_`), and the branch format in the comment (`flotilla/<code>-<slug>`). | **Fixed.** |
| m11 | handoffs/phase1-04 | The fake agent couldn't simulate "usage only at turn end", which is the case the cap actually has to handle. The cancel order wasn't specified. | **Fixed**: `--usage-at-end`; cancel order SIGINT → SIGTERM → SIGKILL at 10 s. |
| m12 | handoffs/phase1-06 | No fixture for a killed run with no result line. | **Fixed**: added. The runner falls back to its estimate. |
| m13 | handoffs/phase1-06 | "Session id from the init/system line" is **unverified**. | **Not fixed.** Unit 06 must confirm it against a real recording, or mark it unverified in its runlog. |
| m14 | scripts/gen_parity.py | The source path was hardcoded to `/workspace/flotilla/...`. | **Fixed**: relative to the script, and checked from `/tmp`. |
| m15 | research/BASE.md §4 | The OpenHands "own harness" and "Electron/TS app" claims had no label. | **Fixed**: labelled [I]/[G], unverified. |
| m16 | SPEC §6b | "Vendor session stays on disk for resume" was stated as fact. | **Fixed**: [I, unverified]. |
| m17 | ROADMAP, handoffs/phase1-11 | Unit titles, the owned paths and the exit demo still said Caddy. Unit 11 needed the compose port. | **Fixed**: the demo now covers the `:8081` preview and the 5+1 crew limit. Unit 11 owns publishing `:8081`. |

## Needs mehdi's call

1. **M3**: how to handle subscription-login Claude in P1, given that repo-controlled Claude hooks and MCP run next to the login volume. The three options are listed in M3.
2. **M10**: the Anthropic-terms question about the login volume. It's still unverified.
3. **M11**: if Devin has no Docker, decide where the Docker integration tests run.
4. **M9**: whether to accept refining generic parity rows phase by phase (proposed) rather than now.
5. **Checklist**: the GitHub steps (repo with initial commit, protected `flotilla/p1`, app installs with workflows permission) are his to do. Nothing was touched on GitHub.

## Not changed on purpose
- Phase split (P1 = 52 rows) and the 12-unit, 4-wave order. The dependencies still hold after the fixes: 11 depends only on 05, and 12 now needs no Docker.
- The native harness stays P2 and is benchmarked only against our own adapters.
