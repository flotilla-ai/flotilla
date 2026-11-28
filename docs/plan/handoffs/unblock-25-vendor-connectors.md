GOAL
Unblock CAPY-422, CAPY-424, CAPY-425, CAPY-426: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-25-vendor-connectors
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: apps/server/src/connectors, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-25.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-422`: Vercel preview detection with best-URL ordering. Test proves: Vercel preview detection reads deploy comments and deployment statuses from the fixture gateway and orders URLs best-first (branch alias, then deployment URL).
- `CAPY-424`: Paper design files read/edit in threads. Test proves: a Paper connector reads and edits a design file through a local mock of the Paper MCP server from a thread tool call.
- `CAPY-425`: Marketplace plugins named publicly: ClickStack, Supermemory, Keiki. Test proves: the marketplace lists the named vendor plugins (ClickStack, Supermemory, Keiki) from a local catalog fixture and installs one against a mock MCP server.
- `CAPY-426`: Web search/retrieval (Firecrawl, Exa). Test proves: web search and retrieval tools call a provider interface (Firecrawl, Exa) against a local mock and return results to the agent; no key configured returns a clear error.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-422, CAPY-424, CAPY-425, CAPY-426
