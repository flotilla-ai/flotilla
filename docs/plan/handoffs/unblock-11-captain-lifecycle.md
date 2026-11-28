GOAL
Unblock CAPY-069, CAPY-072, CAPY-076, CAPY-077, CAPY-095, CAPY-099: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-11-captain-lifecycle
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-10
SCOPE: apps/server/src/captain-lifecycle, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-11.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-069`: Promote a folder: its threads join the crew, folder removed. Test proves: a folder entity holds threads; promoting a folder to a Captain moves its threads into the crew and removes the folder.
- `CAPY-072`: Demote to thread / Archive (puts crew to sleep) / Unarchive / Delete (crew returns to list). Test proves: archiving a Captain puts every crew machine to sleep; unarchive restores it; delete returns crew threads to the list; demote makes it a plain thread.
- `CAPY-076`: Crew threads open beside the Captain's chat; Captain hears each crew turn end / need. Test proves: a crew turn end and a crew need each append a Captain event shown beside the chat and wake the Captain once.
- `CAPY-077`: Captain hears when a crew thread answered you directly. Test proves: when the user messages a crew thread directly and it answers, the Captain receives a `crew.answered_user` event naming the thread.
- `CAPY-095`: Captains on a schedule via automations; automations/Slack hand Captain new tickets. Test proves: a scheduled automation with a Captain target starts or messages that Captain thread instead of an ordinary thread; a new ticket is handed to it.
- `CAPY-099`: Captain starts work on a change you mention in passing. Test proves: a chat observer sees a passing mention of a change in a Captain chat message and starts one crew thread for it (fake model); a message without one starts none.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-069, CAPY-072, CAPY-076, CAPY-077, CAPY-095, CAPY-099
