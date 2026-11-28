GOAL
Unblock CAPY-062, CAPY-070, CAPY-190, CAPY-317: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-10-agent-tools
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/agent-tools, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-10.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-062`: Sibling threads created and messaged by a coordinating agent. Test proves: a non-Captain thread calls agent tools `sibling.create` and `sibling.message` with its run token; the sibling thread exists with the same parent and receives the message; another owner is refused.
- `CAPY-070`: Create a Captain by asking any thread ('Make a Captain called Mobile…'). Test proves: a thread calling the agent tool `captain.create` with a name (from "Make a Captain called Mobile") creates that Captain owned by the thread owner.
- `CAPY-190`: Agent can read/replace whole setup via environment tools (with boundaries). Test proves: `environment.read` and `environment.replace` are listed in the agent tool registry and callable with a run token; another project is refused.
- `CAPY-317`: Agent proposes missing plugin in-thread. Test proves: an agent calling `mcp.propose` creates the same proposal and in-thread card as POST `/threads/:id/mcp/proposals`.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-062, CAPY-070, CAPY-190, CAPY-317
