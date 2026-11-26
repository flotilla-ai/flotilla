# UNIT 09: Git mirror: seed thread workspaces, push from a server-owned bare repo
GOAL: Keep a server-owned bare mirror per project, seed each thread container from a `git bundle`, and push the thread's `flotilla/*` commits from the mirror with hooks and repo config disabled, never running git inside an agent-writable directory.
BRANCH: flotilla/09-git-mirror   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 02 and 05 merged.
SCOPE (you own only these paths): `apps/server/src/git/**` + tests, `docs/runlog/09-git-mirror.md`
OUT OF SCOPE: PR creation, CI, autofix (14); GitHub App flow (P2).
SHAPES: `Project`, `Thread` from `@flotilla/core/types`; `assertPushAllowed` from `@flotilla/core/kernel/branchGuard`; driver `copyIn/copyOut/transport` from unit 05. API: `ensureMirror(project)` (bare clone/fetch under `/data/mirrors/<projectId>.git`; the token is passed per command via `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0=http.extraHeader` env, never written to config); `seedWorkspace(thread, project)` (bundle the base branch → `copyIn` → in-container `git clone /tmp/seed.bundle /workspace/<repo>` + `git switch -c flotilla/<code>-<slug>` via the thread's transport); `collectAndPush(thread, project) → {pushedSha} | KernelDenied` (in-container `git bundle create` of `refs/heads/flotilla/*` → `copyOut` → `git fetch` into `refs/incoming/<threadId>/*` in the mirror → `assertPushAllowed` per ref → `git -c core.hooksPath=/dev/null -c core.fsmonitor=false push` with `GIT_CONFIG_NOSYSTEM=1` and an empty `HOME`); `checkVisibility(project)` (GitHub says public → force `trust: "untrusted"` and emit `kernel.denied` with rule `scope` if it was trusted).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/server test -- git
```
EXPECTED: with a local bare repo as the "GitHub" remote (file://) and a FakeDriver backed by a temp dir: seed produces a clone on `flotilla/<code>-<slug>`; a test plants an executable `.git/hooks/pre-push`, `core.sshCommand`, `core.fsmonitor` and `credential.helper` in the thread worktree and proves none runs during push (marker files absent); a bundle containing `refs/heads/main` is refused with `kernel.denied`; the mirror's `config` never contains the token; pushes are serialised per repo (two concurrent pushes don't interleave). Real-container variant behind `FLOTILLA_DOCKER_IT=1`.
DIFF BUDGET: ≤ 12 files / ≤ 700 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Why (SPEC §6a "Git", §13 "Server-side git", REVIEW-1 B2, REVIEW-2 F-01): the server holds the token and the Docker socket, so it must never execute git config or hooks an agent could have written.

## Rules (hard)
- Work on branch `flotilla/09-git-mirror` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "09-git-mirror: Git mirror: seed thread workspaces, push from a server-owned bare repo" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/09-git-mirror`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/09-git-mirror.md` DECISIONS) and anything left unverified.
