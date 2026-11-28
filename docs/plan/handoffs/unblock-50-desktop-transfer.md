GOAL
Unblock CAPY-237, CAPY-238, CAPY-239, CAPY-242, CAPY-243: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-50-desktop-transfer
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-34, unblock-49
SCOPE: apps/server/src/device-transfer, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-50.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-237`: Continue on / Move to a device / Return to your device (cloud↔device↔device via cloud). Test proves: Continue on / Move to a device / Return to your device moves a thread cloud to device, device to cloud, and device to device through the cloud (fake devices).
- `CAPY-238`: What moves (branch, commits, staged/unstaged/untracked, workspace files) vs stays (.gitignored, >2 MB untracked, processes). Test proves: a move carries branch, commits, staged, unstaged and untracked files; `.gitignore`d files, untracked files over 2 MB and processes stay.
- `CAPY-239`: Move refused while repo mid-merge/rebase or other threads on machine. Test proves: a move is refused while the repo is mid-merge or mid-rebase, or other threads use the machine.
- `CAPY-242`: Device access: Personal (approve each request) / Shared (team + org API keys); Agent access Always allow. Test proves: device access Personal requires approval per request; Shared lets team threads and org API keys use it; Agent access Always allow skips the prompt.
- `CAPY-243`: Admins see, rename, revoke every paired device. Test proves: admins list, rename and revoke every paired device in the org.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-237, CAPY-238, CAPY-239, CAPY-242, CAPY-243
