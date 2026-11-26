# UNIT 02: Event store + P1 schema + SSE
GOAL: Persist events append-only in Postgres, update the P1 rows in the same transaction, own the whole P1 schema, and stream a thread's events over SSE with Postgres LISTEN/NOTIFY.
BRANCH: flotilla/02-event-store   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 01 merged.
SCOPE (you own only these paths): `apps/server/src/db/**` (Drizzle schema + migrations for **every P1 table**: `users`, `sessions`, `projects`, `threads`, `runs`, `events`, `approvals`, `cost_entries`, `budget_holds`, `captains` (incl. `digest_md`), `prs`), `apps/server/src/events/**` (append, row updates, notify/listen), `apps/server/src/routes/stream.route.ts`, their tests, `docs/runlog/02-event-store.md`
OUT OF SCOPE: Kernel rules (03), adapters (04), runner (11), UI (12/13), auth logic (08). No `outbox` table and no job queue (P2). No Automation/DriveItem tables.
SHAPES: `Event`, `EventKind`, `Thread`, `Run`, `Approval`, `CostTotals`, `Project`, `User`, `Hold` from `@flotilla/core/types`. API: `appendEvents(threadId, events: Omit<Event,'id'|'seq'|'at'>[], {requestId?, apply?: (tx) => Promise<void>}) → Event[]` (`apply` = the caller's row updates, run in the same transaction); `subscribe(threadId, afterSeq) → AsyncIterable<Event>` backed by `LISTEN flotilla_events` (payload `{threadId, seq}` only); route `GET /api/v1/threads/:id/stream?after=<seq>` (SSE, `id:` = seq, replays from `after`, then live).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/server test -- events
```
EXPECTED: tests prove (a) seq is gap-free per thread under 20 concurrent appends, (b) a thrown `apply` error rolls back the event insert (no row), (c) duplicate `requestId` returns the original events, (d) SSE client with `after=2` receives seq 3,4,5 in order then live events, (e) an append on one pg connection reaches a `subscribe` on **another** connection via NOTIFY (multi-process proof), (f) the NOTIFY payload never contains event payload data. Tests run against Postgres from `docker compose` or testcontainers; if neither works in your VM, use pg-mem for (a)-(d) and mark (e) unverified.
DIFF BUDGET: ≤ 16 files / ≤ 800 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Pattern reference (read, don't copy Effect code): T3 Code commits events + projections in one transaction (https://github.com/pingdotgg/t3code/blob/d6061ec8ad2fa71fe54b3e306e0b8e283ca33bac/docs/internals/01_architecture.md (lines 30-47), MIT). We skip its receipts and outbox in P1 (SPEC.md §4 "Persistence").
- Keep the full log; no retention window.
- You own the schema for all P1 tables so no later unit edits `db/`. Columns follow SPEC.md §4 types; if a later unit needs a column, it stops and reports.

## Rules (hard)
- Work on branch `flotilla/02-event-store` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "02-event-store: Event store + P1 schema + SSE" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/02-event-store`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/02-event-store.md` DECISIONS) and anything left unverified.
