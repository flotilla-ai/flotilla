GOAL
Unblock CAPY-067, CAPY-078, CAPY-098, CAPY-153, CAPY-495: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-05-web-captain-automations
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/web/src/features/captain-ui, apps/web/src/features/automations, apps/web/src/features/virtual-list, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-05.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-067`: New Captain dialog: name, face/avatar, project, machine, model, access. Test proves: a New Captain dialog collects name, face, project, machine, model and access and POSTs the Captain create API; missing name blocks submit.
- `CAPY-078`: Filter Pull requests page by Captain. Test proves: the Pull requests page has a Captain filter; choosing a Captain lists only PRs from its crew threads.
- `CAPY-098`: Captains-first / Hybrid sidebar, pinned Captain faces, each row shows the question it waits on. Test proves: a sidebar mode setting (Captains-first / Hybrid) persists; pinned Captain faces render first and each Captain row shows the question it waits on.
- `CAPY-153`: Manage on Automations page or by asking the agent (full automation tools). Test proves: an Automations page lists, creates, edits, pauses and deletes automations through the automation REST API.
- `CAPY-495`: Large crews / hundreds of subagents render without freezing. Test proves: a crew list of 500 rows mounts at most a window of DOM rows (virtual list) and scrolls to row 400.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-067, CAPY-078, CAPY-098, CAPY-153, CAPY-495
