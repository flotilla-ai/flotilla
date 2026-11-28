GOAL
Unblock CAPY-357, CAPY-358, CAPY-359, CAPY-360, CAPY-364: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-17-org-core
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/orgs, apps/web/src/features/orgs, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-17.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-357`: Roles Owner/Admin/Member; multiple owners. Test proves: an org has Owner / Admin / Member roles; two owners are allowed; the last owner cannot be demoted or removed.
- `CAPY-358`: Invite by email; revoke pending. Test proves: an admin invites by email (hashed single-use token), the invitee accepts and becomes a member; a revoked pending invite is refused.
- `CAPY-359`: Join by verified email domain. Test proves: a user whose verified email domain matches an org verified domain can join without an invite; an unverified email cannot.
- `CAPY-360`: Promote/demote/remove; leave via admin. Test proves: admins promote, demote and remove members; a member cannot remove themselves (leave goes through an admin) and cannot change roles.
- `CAPY-364`: Multiple organizations; org switch; create second org. Test proves: a user creates a second org, switches the active org, and lists only the active org data.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-357, CAPY-358, CAPY-359, CAPY-360, CAPY-364
