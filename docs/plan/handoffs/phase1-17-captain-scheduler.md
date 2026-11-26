# UNIT 17: Captain scheduler: wakes, coalescing, heartbeat backoff, digest
GOAL: Schedule Captain turns from crew events (firstmate triage), coalesce bursts, back off heartbeats when idle, and keep DIGEST.md plus a structured Needs-you list current.
BRANCH: flotilla/17-captain-scheduler   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 16 merged.
SCOPE (you own only these paths): `apps/server/src/captain/scheduler/**` + tests, `apps/server/src/modules/captain.module.ts`, `docs/runlog/17-captain-scheduler.md`
OUT OF SCOPE: Hooks (P2), wedge ladder with `stale`/`wedged` (P2), promote/demote UI, Slack.
SHAPES: `Captain`, `Event` kind `crew.status` with firstmate's vocabulary (`done|needs-decision|blocked|failed|paused|captain-held|resolved`), `Approval`. `triage(events) → {wake: boolean; reasons}`; the wake prompt always includes the Captain's purpose, current digest and crew state (CAPY-071/086).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/server test -- captain-scheduler    # fake clock, FakeMachineDriver
```
EXPECTED: 3 crew `done` events within 30 s → exactly 1 Captain wake; `paused` and `captain-held` → 0 wakes; heartbeat interval doubles from 600 s up to 7,200 s while nothing changes and resets on a wake; `budget.*` and `kernel.denied` always wake; DIGEST.md contains `## Needs you`, `## New`, `## In progress`, and the server's structured Needs-you list equals the open Approvals even if the digest text omits one; timers survive a server restart (rows in Postgres).
DIFF BUDGET: ≤ 10 files / ≤ 600 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Triage rules ported from firstmate (MIT): https://github.com/kunchenguid/firstmate/blob/99313281a8dab2cabecd285fcfcd1da9f9b9058f/bin/fm-watch.sh (lines 2-80, 346-371), https://github.com/kunchenguid/firstmate/blob/99313281a8dab2cabecd285fcfcd1da9f9b9058f/bin/fm-classify-lib.sh (lines 84-149). Port the semantics into TS; don't copy bash.

## Rules (hard)
- Work on branch `flotilla/17-captain-scheduler` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "17-captain-scheduler: Captain scheduler: wakes, coalescing, heartbeat backoff, digest" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/17-captain-scheduler`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/17-captain-scheduler.md` DECISIONS) and anything left unverified.
