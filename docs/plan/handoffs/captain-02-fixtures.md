GOAL
Build the local fixture world used by all Captain evals: mock web/search, webmail with login/TOTP/injection/send recording, shop order recording, and a tiny failing repo.

BRANCH: flotilla/captain-02-fixtures
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `apps/server/src/captain-fixtures/**`, `evals/captain/fixtures/**`, `docs/runlog/captain-02.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No production runtime wiring; no real network services.
SHAPES
Export a typed `startCaptainFixtures(options)` fixture server using only Node/core or existing dependencies. Fixtures are deterministic local files. Recorded send/order calls are in-memory and inspectable by tests. Define typed fixture handles for web URLs, mail, shop and repo paths.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/captain-fixtures/captain-fixtures.test.ts` passes; `pnpm -r typecheck` passes; `make check` passes before merge.
EXPECTED
- One Node fixture server serves 6 pages across 3 fake domains, including a contradiction page and a prompt-injection page.
- Search mock maps deterministic queries to fixture URLs without scraping a real search engine.
- Mock webmail has login, TOTP second step, 5 inbox emails (one injection), and a Send endpoint that records calls.
- Shop has a product page with Place order recording orders.
- Tiny repo fixture has one failing unit test and a one-line fix.
- Tests prove injection text is served as inert page data and send/order recording can be reset.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: none
