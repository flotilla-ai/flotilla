GOAL
Unblock CAPY-104, CAPY-105, CAPY-106, CAPY-496: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-07-issues-web-board
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-06
SCOPE: apps/web/src/features/issues-board, apps/server/src/issues-web, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-07.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-104`: Issues board (columns per status, drag, bulk move, undo, keyboard). Test proves: a board has one column per status; moving a card (drag or keyboard) updates status; bulk move changes N selected cards; Undo restores them.
- `CAPY-105`: Saved issue views; editable title; reply to/edit comments in place. Test proves: saved issue views are created, listed and reapplied; the title edits in place; a comment can be replied to and edited in place.
- `CAPY-106`: Custom issue states (create/order/default), labels, issue prefix. Test proves: custom states are created, reordered and one set default; labels and the issue prefix are editable and new issues use the prefix.
- `CAPY-496`: Display menu groups/orders issues, hides row properties; comments tag skills/PRs/files. Test proves: a Display menu groups and orders issues and hides row properties; a comment can tag a skill, PR or file and renders the tag as a link.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-104, CAPY-105, CAPY-106, CAPY-496
