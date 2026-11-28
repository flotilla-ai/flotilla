GOAL
Unblock CAPY-051, CAPY-251, CAPY-277: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-36-byom-transfer-installers
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-33
SCOPE: apps/runner, apps/server/src/byom, deploy/install, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-36.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-051`: Background file transfers between any two machines. Test proves: a background file transfer between two machines runs rsync over ssh against a local sshd container (or mocked, marked unverified) and wakes the thread on completion.
- `CAPY-251`: Installer: curl\|sh (Linux/macOS) and irm\|iex (Windows); refuses root/admin. Test proves: `install.sh` and `install.ps1` exist; argument handling is unit-tested (version, dir, refusal as root/admin); they are never executed against a real system.
- `CAPY-277`: Local threads get a copy in ~/.capy/drive/; no background sync. Test proves: a local thread unpacks the Drive copy tar into `~/.flotilla/drive/` once at start; later Drive edits do not appear (no background sync).
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-051, CAPY-251, CAPY-277
