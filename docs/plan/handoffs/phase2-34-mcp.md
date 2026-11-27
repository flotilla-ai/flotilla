# phase2-34: MCP registry and plugins

GOAL: Remote/stdio MCP config, auth states, imports, tests, secret redaction, approvals. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-34-mcp
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/mcp*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/mcp*` only when this unit has UI rows
- `packages/**/mcp*` only when this unit owns adapter/package behavior
- `scripts/test-mcp*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-34-mcp.md`
- `docs/runlog/phase2-34.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `McpServer`, `McpAuth`, `McpImport`, `McpTestResult`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-302` — MCP servers: Streamable HTTP (remote) or STDIO (runs on thread machine). Flotilla equivalent: MCP registry, passed to adapters as MCP config; [ADP] pass MCP config to each adapter's native MCP support.
- `CAPY-303` — Tool-name key prefix per server. Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-305` — Auth: OAuth sign-in (auto refresh), API key headers (encrypted), none; variables headers. Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-307` — Bring your own OAuth client; documented redirect URI. Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-308` — Let Capy set it up (Review card). Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-309` — Import from Claude Code JSON, Codex TOML, URL or command line. Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-310` — Statuses, Test button with failing step, 403 checklist. Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-311` — MCP error redaction of configured secrets (≥8 chars, exact). Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-317` — Agent proposes missing plugin in-thread. Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-519` — Thread asks one-click approval to rename/enable/widen an MCP server. Flotilla equivalent: MCP registry, passed to adapters as MCP config.
- `CAPY-520` — Connection rows show 'Finish in your browser' with Cancel. Flotilla equivalent: MCP registry, passed to adapters as MCP config.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-34.md`; never claim unrun behavior.

ROWS: CAPY-302, CAPY-303, CAPY-305, CAPY-307, CAPY-308, CAPY-309, CAPY-310, CAPY-311, CAPY-317, CAPY-519, CAPY-520
