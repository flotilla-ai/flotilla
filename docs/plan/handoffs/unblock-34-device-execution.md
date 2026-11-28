GOAL
Unblock CAPY-061, CAPY-091, CAPY-092, CAPY-232, CAPY-233, CAPY-244, CAPY-246, CAPY-490: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-34-device-execution
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-33
SCOPE: apps/server/src/device-plane, apps/web/src/features/device-placement, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-34.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-061`: Subagent on a named paired device while parent stays in cloud. Test proves: a subagent placed on a named paired device runs on the fake device while its parent stays on the pool.
- `CAPY-091`: Captain runs in cloud by default and sleeps between turns; can run on a paired device. Test proves: a Captain runs on the pool by default and sleeps between turns; configured for a paired device it runs on the fake device.
- `CAPY-092`: 'Crew runs on' setting: cloud or one paired device; name a machine per thread. Test proves: Crew runs on = one paired device places crew threads there; a per-thread machine name overrides it.
- `CAPY-232`: No machine-time charge for local threads. Test proves: a thread run on a paired device writes no machine-time cost entry.
- `CAPY-233`: Follow/reply to local threads from any browser incl. phone. Test proves: events from a thread running on the fake device stream to a browser session and a reply from the browser reaches the device run.
- `CAPY-244`: Agent runs as you with your git identity; linked folder is not a sandbox. Test proves: the device run uses the user git identity from the device and the linked folder path directly (no container), recorded as `sandbox: none`.
- `CAPY-246`: Free models on This Mac with no plan. Test proves: with no connection configured a device thread may use only free models; a paid model is refused.
- `CAPY-490`: Thread rows show cloud vs paired device; thread waits for device reconnect. Test proves: thread rows show `cloud` or the device name; a thread whose device is offline shows waiting for reconnect and resumes when the device reconnects.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-061, CAPY-091, CAPY-092, CAPY-232, CAPY-233, CAPY-244, CAPY-246, CAPY-490
