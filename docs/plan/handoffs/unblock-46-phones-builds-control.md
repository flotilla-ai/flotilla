GOAL
Unblock CAPY-265, CAPY-266, CAPY-267, CAPY-268, CAPY-269, CAPY-270: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-46-phones-builds-control
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-45
SCOPE: apps/server/src/phone-builds, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-46.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-265`: Mobile builds on Revyl runners (Expo/RN, native iOS, native Android) with build row in chat. Test proves: a mobile build (Expo/RN, native iOS, native Android) runs on the fake provider runner and a build row appears in the thread.
- `CAPY-266`: Build limits: queue cancel after 2 h, one infra retry. Test proves: a build queued for 2 h is cancelled (fake clock) and an infrastructure failure is retried exactly once.
- `CAPY-267`: iOS runner spec (macOS 26.6.2, Xcode 27.0…). Test proves: the iOS runner spec (macOS and Xcode versions) is read from the provider and shown; it is never hard-coded as a live claim.
- `CAPY-268`: Watch/use phone live; Home/Back/Rotate/Open URL toolbar. Test proves: the control bridge sends Home, Back, Rotate and Open URL to the fake phone and the live view streams frames.
- `CAPY-269`: Sessions ≤60 min; sleep keeps build, not app data; shared slots; 'Waiting for a phone'. Test proves: sessions end at 60 min; sleep keeps the build but not app data; with no free slot the thread shows Waiting for a phone.
- `CAPY-270`: Read app logs (logcat; iOS os_log/NSLog). Test proves: app logs (logcat; iOS os_log) are read from the fake provider through an agent tool.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-265, CAPY-266, CAPY-267, CAPY-268, CAPY-269, CAPY-270
