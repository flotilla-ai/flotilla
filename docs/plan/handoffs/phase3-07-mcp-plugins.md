GOAL
Implement the smallest fixture-backed Flotilla foundation for mcp plugin packaging and lifecycle, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-07-mcp-plugins
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/plugin-lifecycle, apps/web/src/features/plugin-lifecycle, docs/runlog/phase3-07.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/07-mcp-plugins*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-304`: Owner Organization/Only you; All projects/one project; private overrides org on key clash — Flotilla equivalent: MCP registry, passed to adapters as MCP config
- `CAPY-306`: Per-person OAuth (Connection mode: Each member); Private threads only — Flotilla equivalent: MCP registry, passed to adapters as MCP config
- `CAPY-313`: Plugin from GitHub repo/folder, manual Sync — Flotilla equivalent: MCP registry, passed to adapters as MCP config
- `CAPY-314`: Plugin keys collected at install, unreadable by members; per-server connect — Flotilla equivalent: MCP registry, passed to adapters as MCP config
- `CAPY-315`: Auto-updates; 'Update needs you' when scopes/keys widen; roll back — Flotilla equivalent: MCP registry, passed to adapters as MCP config
- `CAPY-316`: Build a plugin per Agent Plugins spec 1.0.0/1.1.0 (plugin.json, mcp.json) — Flotilla equivalent: MCP registry, passed to adapters as MCP config; Flotilla can consume the same spec
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-304, CAPY-306, CAPY-313, CAPY-314, CAPY-315, CAPY-316
