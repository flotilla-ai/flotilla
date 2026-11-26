# UNIT 08: Auth (first-run admin, sessions), projects, read APIs
GOAL: First-run admin setup, password login with a session cookie, the real `requireSession`, project CRUD with a trust flag, and the read APIs the UI and the P1 demo need.
BRANCH: flotilla/08-auth-projects-api   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 02 merged.
SCOPE (you own only these paths): `apps/server/src/auth/**` (takes over `requireSession.ts` from unit 01), `apps/server/src/projects/**`, `apps/server/src/routes/{auth,projects,read}.route.ts`, `apps/server/src/modules/setup.module.ts`, tests, `docs/runlog/08-auth-projects-api.md`
OUT OF SCOPE: Multi-user, roles, SSO (P3); GitHub calls (09/14); thread writes (11); UI (12).
SHAPES: `User`, `Project`, `Thread`, `Event`, `Approval` from `@flotilla/core/types`. Routes: `POST /api/v1/auth/setup` (one-time setup token printed by `setup.module.ts` on first start when no user exists; creates the admin), `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` (public: setup, login); `GET/POST /api/v1/projects`, `GET /api/v1/projects/:id`, `PATCH /api/v1/projects/:id` (`trust`, `egressAllow`, `budget`); `GET /api/v1/threads`, `GET /api/v1/threads/:id`, `GET /api/v1/threads/:id/messages` (paginated by seq), `GET /api/v1/approvals?state=open` (Capy-compatible paths, CAPY-536/537/541/543/599).
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/server test -- auth projects read
```
EXPECTED: setup works once with the printed token and then returns 409; wrong password → 401 with constant-time compare, scrypt hashes only; session cookie `flotilla_session` is HttpOnly, SameSite=Lax, host-only, `Secure` when served over https, and rotates on login; `requireSession` → 401 without a cookie, 200 with one, and every non-GET needs header `X-Flotilla-CSRF` matching the session (403 otherwise); a new project defaults to `trust: "untrusted"`; setting `trusted` requires `confirm: "private-and-mine"` in the body; read APIs return seeded rows in order and 404 for other users' ids.
DIFF BUDGET: ≤ 16 files / ≤ 850 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- P1 is single admin (SPEC §15 still-open 5); keep `role` on the row for P3.
- The P1 exit demo and units 12/13/15 rely on these routes; paths are locked (SPEC §4, F-22).

## Rules (hard)
- Work on branch `flotilla/08-auth-projects-api` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "08-auth-projects-api: Auth (first-run admin, sessions), projects, read APIs" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/08-auth-projects-api`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/08-auth-projects-api.md` DECISIONS) and anything left unverified.
