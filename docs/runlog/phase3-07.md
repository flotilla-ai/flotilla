# phase3-07 MCP plugin lifecycle

Rows: CAPY-304, CAPY-306, CAPY-313, CAPY-314, CAPY-315, CAPY-316.

Verification:
- `pnpm --filter @flotilla/server exec vitest run src/plugin-lifecycle/plugin-lifecycle.test.ts` — passed, 1 test.
- `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` — passed.
- `cd apps/web && pnpm exec vitest run src/features/plugin-lifecycle/plugin-lifecycle.test.tsx` — passed, 1 test.
- `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` — passed.

The server fixture installs GitHub repo/folder plugins through an injected `fetch` fixture for `plugin.json`/`mcp.json`; no live GitHub or vendor call was made. Secret values are sealed and tests assert API/resolve output contains key names only. Browser interaction beyond static rendering is unverified. Automatic update scanning is implemented as `autoSyncDue`; external scheduler wiring is not separately verified in this unit.
