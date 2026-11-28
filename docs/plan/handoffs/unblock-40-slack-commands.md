GOAL
Unblock CAPY-093, CAPY-408, CAPY-410, CAPY-411: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-40-slack-commands
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-39
SCOPE: apps/server/src/slack-commands, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-40.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-093`: Steer a Captain from Slack with captain=<name\|alias\|code>, !queue/!steer. Test proves: a Slack mention with `captain=<name|alias|code>` and `!queue` / `!steer` is delivered to that Captain in the named mode.
- `CAPY-408`: Thread controls: help, aside/!aside, mute/unmute, archive, stop, unlink, !web. Test proves: thread controls help, aside / !aside, mute / unmute, archive, stop, unlink and !web each act on the linked thread.
- `CAPY-410`: Directives project/folder/channel/title/model/reasoning/machine/captain. Test proves: directives project / folder / channel / title / model / reasoning / machine / captain set the corresponding fields on the created thread.
- `CAPY-411`: Bang flags !new !web !fast !pro !standard !<effort> !queue !steer. Test proves: bang flags !new !web !fast !pro !standard !<effort> !queue !steer are parsed and applied; unknown flags are left in the text.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-093, CAPY-408, CAPY-410, CAPY-411
