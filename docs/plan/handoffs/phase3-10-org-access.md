GOAL
Implement the smallest fixture-backed Flotilla foundation for organizations, members and access control, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-10-org-access
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/org-access, apps/web/src/features/org-access, docs/runlog/phase3-10.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/org-access*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-357`: Roles Owner/Admin/Member; multiple owners — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-358`: Invite by email; revoke pending — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-359`: Join by verified email domain — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-360`: Promote/demote/remove; leave via admin — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-361`: Service users with roles, project access, subscription grants — Flotilla equivalent: Org/members/roles (multi-user); [NOCLAUDE] no shared subscription grants for Claude
- `CAPY-362`: Visibility: shared vs private for projects, threads, Captains, folders; /private, /shared — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-363`: Org sharing settings: Private work toggle, default access, member default — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-364`: Multiple organizations; org switch; create second org — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-365`: Delete/restore organization; delete account — Flotilla equivalent: Org/members/roles (multi-user); [TX]
- `CAPY-366`: Work from departed members; transfer thread/Captain/project — Flotilla equivalent: Org/members/roles (multi-user)
- `CAPY-367`: Audit log — Flotilla equivalent: Org/members/roles (multi-user); details not public
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-357, CAPY-358, CAPY-359, CAPY-360, CAPY-361, CAPY-362, CAPY-363, CAPY-364, CAPY-365, CAPY-366, CAPY-367
