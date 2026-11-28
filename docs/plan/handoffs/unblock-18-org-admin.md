GOAL
Unblock CAPY-361, CAPY-362, CAPY-363, CAPY-365, CAPY-366, CAPY-367: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-18-org-admin
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-17
SCOPE: apps/server/src/org-admin, apps/web/src/features/org-admin, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-18.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-361`: Service users with roles, project access, subscription grants. Test proves: a service user has a role, project access list and subscription grants; its token reaches only granted projects.
- `CAPY-362`: Visibility: shared vs private for projects, threads, Captains, folders; /private, /shared. Test proves: projects, threads, Captains and folders carry `shared` or `private` visibility; `/private` and `/shared` set it; private items return 404 to other members.
- `CAPY-363`: Org sharing settings: Private work toggle, default access, member default. Test proves: org sharing settings (Private work toggle, default access, member default) apply to newly created items; with Private work off, private creation is refused.
- `CAPY-365`: Delete/restore organization; delete account. Test proves: an owner deletes an org (soft, hidden) and restores it within the window; a user deletes their account and can no longer sign in.
- `CAPY-366`: Work from departed members; transfer thread/Captain/project. Test proves: work of a removed member stays listed as departed; an admin transfers a thread, Captain and project to another member.
- `CAPY-367`: Audit log. Test proves: role change, invite, removal, transfer and delete each append an audit log entry (actor, action, target, time) readable by admins only.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-361, CAPY-362, CAPY-363, CAPY-365, CAPY-366, CAPY-367
