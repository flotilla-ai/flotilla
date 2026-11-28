GOAL
Unblock CAPY-043, CAPY-050, CAPY-332, CAPY-485: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-04-web-settings-models
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/web/src/features/model-picker, apps/web/src/features/connections, apps/web/src/features/wake-settings, apps/server/src/wakes (BYOM auto-hold only), one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-04.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-043`: Per-event response setting: React / Keep as context / Ignore; org tab + personal override. Test proves: a Wake settings screen shows React / Keep as context / Ignore per event with an Org tab (admin only, PUT `/wake-settings/org`) and a personal override (PUT `/wake-settings/me`).
- `CAPY-050`: Thread on someone's computer holds incoming messages until owner allows. Test proves: a thread placed on a paired device has hold enabled automatically at creation; the thread view lists held messages with Allow and Decline for the owner only.
- `CAPY-332`: Model picker badges (subscription/key/credits), tooltip names connection; favorites with ⌥1–9. Test proves: the model picker shows a text label subscription / key / credits per model, a tooltip naming the connection, and Alt+1..9 selects favorite 1..9.
- `CAPY-485`: Change a connection's Base URL. Test proves: a connections editor edits Base URL (PATCH `/connections/:id`), rejects non-http(s) URLs inline, and shows the saved value after reload.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-043, CAPY-050, CAPY-332, CAPY-485
