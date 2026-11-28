GOAL
Implement BEYOND-002: allowlisted computer tools through the Flotilla MCP proxy, including CDP screenshot/click/type/scroll fallback and hard blocks on unsafe browser/cookie/storage access.

BRANCH: flotilla/captain-07-computer-proxy
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-03 and captain-04 merged
SCOPE: `apps/server/src/computer-proxy/**`, `apps/server/src/routes/computer-mcp.route.ts`, `docs/runlog/captain-07.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No live view/takeover UI (captain-12); no raw CDP endpoint exposed to agents; no file upload outside run workspace.
SHAPES
Define typed computer tool input/output schemas and a proxy interface to the computer lifecycle driver. Every page result is fenced untrusted. Every action passes the action gate. One run owns one tab/screen. CDP fallback tools use typed `Input.dispatch*` operations only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/computer-proxy/computer-proxy.test.ts` passes against a mocked CDP endpoint or local fixture; `make check` passes before merge.
EXPECTED
- Allows only: `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`, `browser_click`, `browser_type`, `browser_press_key`, `browser_select_option`, `browser_hover`, `browser_wait_for`, `browser_tabs`, `browser_navigate_back`, workspace-confined `browser_file_upload`, plus `computer.screenshot`, `computer.click_xy`, `computer.type_text`, `computer.scroll`.
- Blocks `browser_evaluate`, `browser_run_code_unsafe` and cookie/storage-reading/exporting CDP methods, with tests.
- Only authorized Captain/crew runs receive `/mcp/computer` with per-run token.
- Snapshot-first default; screenshots only when requested or snapshot empty.
- Typing into `input[type=password]` is classified credential-entry and always asks.
- Computer calls during a human takeover return 409 once captain-12 exists; this unit defines the lock hook seam.
DIFF BUDGET: <= 15 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-002
