GOAL
Unblock CAPY-323, CAPY-324, CAPY-326, CAPY-334, CAPY-482: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-20-org-models
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: unblock-17
SCOPE: apps/server/src/org-models, apps/web/src/features/org-models, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-20.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>` and `pnpm --filter @flotilla/web exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge. UI units attach screenshots to the PR.
EXPECTED
- `CAPY-323`: Azure (organization) models. Test proves: an org-level Azure connection (endpoint, deployment, vault key ref) lists its models for members and passes its base URL and deployment env to the next run (fake adapter).
- `CAPY-324`: Fast mode (priority tier) with fallback to standard. Test proves: fast mode requests the priority tier; when the fake provider refuses the tier the run falls back to standard and records the fallback.
- `CAPY-326`: Modes: fast, pro, ultrafast, daybreak. Test proves: modes fast / pro / ultrafast / daybreak map to model, tier and effort settings on the run request; an unknown mode is rejected.
- `CAPY-334`: Org settings: members can connect own; members choose run-out; Only <key>; Turn off model; Compact at. Test proves: org settings (members connect own, members choose run-out, Only <key>, model off, Compact at) are enforced: an off model cannot be selected and Only <key> refuses other connections.
- `CAPY-482`: Anyone who can see the thread can approve credits; one approval covers a Captain's crew. Test proves: any member who can see the thread approves a credits request; one approval on a Captain covers pending requests of its crew.
- Extra (no row claimed): A-part of CAPY-333 (stays `needs-human-login`): map the Claude and Codex usage-limit exit from recorded fixtures to `run_out`; keep its live command current in the note.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-323, CAPY-324, CAPY-326, CAPY-334, CAPY-482
