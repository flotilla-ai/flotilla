GOAL
Unblock CAPY-228, CAPY-250, CAPY-255, CAPY-257, CAPY-260: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-33-runner-device-plane
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/runner (new package `flotilla-runner`), apps/server/src/device-plane, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-33.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-228`: Sign in with Google, GitHub or email; computer pairs as a device. Test proves: a `flotilla-runner` process signs in with email (Google and GitHub sign-in go through the SSO provider interface, fixture only) and the computer appears as a paired device.
- `CAPY-250`: capy dock: headless device for Linux/macOS/Windows (servers, VMs, spare Macs). Test proves: `flotilla-runner` started as a second process pairs over localhost and executes a fake-adapter thread run headlessly.
- `CAPY-255`: Pairing via link/QR/code approved in Settings → Devices; interactive first run. Test proves: first run prints a link, a QR code (text) and a code; approving in Settings → Devices completes pairing; non-interactive runs take a `--code` flag.
- `CAPY-257`: Runs in foreground; keep alive with tmux/systemd/launchd. Test proves: the runner stays in the foreground, exits non-zero on fatal errors, and ships tmux, systemd and launchd unit templates validated by tests.
- `CAPY-260`: Revoke device; next run re-pairs. Test proves: after the device is revoked the runner gets 401, clears its token, and its next run starts pairing again.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-228, CAPY-250, CAPY-255, CAPY-257, CAPY-260
