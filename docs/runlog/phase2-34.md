# phase2-34 MCP registry and plugins

PR: https://github.com/flotilla-ai/flotilla/pull/55

Branch `flotilla/phase2-34-mcp` from `origin/flotilla/p1` (`eba906f`), then real-merged `6b5546a`. Local MCP/OAuth fixture server (node http), capture adapter, temporary Postgres 16 container. No vendor calls or logins.

## Rows
- done: CAPY-302, CAPY-303, CAPY-305, CAPY-308, CAPY-309, CAPY-310, CAPY-311, CAPY-519, CAPY-520.
- needs-human-login: CAPY-307 (BYO OAuth client proven against a local token fixture only).
- blocked: CAPY-317 (proposal API + in-thread card proven; no agent-callable tool path from the thread machine yet).

## Changes
- `apps/server/src/db/migrations/0022_mcp.sql`: `mcp_servers`, `mcp_oauth_flows`.
- `apps/server/src/mcp/types.ts`: `McpServer`, `McpAuth`, `McpImport`, `McpTestResult`, input parsing, import parsers.
- `apps/server/src/mcp/store.ts`: `McpStore` (sealed values, OAuth PKCE + refresh, Test, proposals, runner `prepare`).
- `apps/server/src/routes/mcp.route.ts`; `runner.ts` writes `/run/flotilla/mcp.json` (0600) when `capabilities.mcp`, applies `kind=mcp` answers; `threads.route.ts` wires `mcpStore`; `secrets/store.ts` exports `tarFile`.
- `apps/web/src/features/mcp/index.tsx`: `#/mcp` rows (status, Test, failing step, 403 checklist, Connect / Finish in your browser + Cancel), Review cards, import box.

## Red first
`npx vitest run src/mcp/mcp.test.ts` before the store/route/migration existed:
```
   × MCP registry > CAPY-302/303: remote and STDIO servers reach the adapter as native MCP config keyed by tool prefix; capability-gated 17ms
   × MCP registry > CAPY-305: API-key headers are encrypted, never returned, and ${VAR} headers resolve from thread env vars 4ms
   × MCP registry > CAPY-307/305: bring-your-own OAuth client with documented redirect URI, PKCE, sealed tokens and auto refresh 4ms
   × MCP registry > CAPY-520: a sign-in shows Finish in your browser with Cancel; cancelled flows cannot complete 3ms
   × MCP registry > CAPY-309: imports Claude Code JSON, Codex TOML, a URL and a command line 4ms
   × MCP registry > CAPY-310/311: Test shows statuses and the failing step, a 403 checklist, and redacts configured secrets (>=8 chars, exact) 7ms
   × MCP registry > CAPY-308/317/519: the agent proposes a missing server or a rename/enable/widen; one-click approval applies it 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/mcp/mcp.test.ts > MCP registry > CAPY-302/303: remote and STDIO servers reach the adapter as native MCP config keyed by tool prefix; capability-gated
 FAIL  src/mcp/mcp.test.ts > MCP registry > CAPY-305: API-key headers are encrypted, never returned, and ${VAR} headers resolve from thread env vars
 FAIL  src/mcp/mcp.test.ts > MCP registry > CAPY-307/305: bring-your-own OAuth client with documented redirect URI, PKCE, sealed tokens and auto refresh
 FAIL  src/mcp/mcp.test.ts > MCP registry > CAPY-520: a sign-in shows Finish in your browser with Cancel; cancelled flows cannot complete
```

## Focused (after)
```
 ✓ src/mcp/mcp.test.ts (7 tests) 3361ms
   ✓ MCP registry > CAPY-307/305: bring-your-own OAuth client with documented redirect URI, PKCE, sealed tokens and auto refresh  1160ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
 ✓ src/features/mcp/mcp.test.tsx (3 tests) 12ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## `make check` (after merging `6b5546a`)
```
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  7 passed (7)
apps/web test:       Tests  19 passed (19)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  24 passed (24)
apps/server test:       Tests  154 passed | 1 skipped (155)
make check exit=0
```

## Unverified / operator commands
- CAPY-307 / OAuth live: register an OAuth app at the MCP vendor with redirect `${FLOTILLA_PUBLIC_URL}/api/v1/mcp/oauth/callback`, then `POST /api/v1/mcp/servers` with `auth: {kind:'oauth', authorizeUrl, tokenUrl, clientId, clientSecret}`, `POST /api/v1/mcp/servers/<id>/oauth/start`, open `authorizeUrl`, finish sign-in, then `POST /api/v1/mcp/servers/<id>/test`.
- Real `claude --mcp-config /run/flotilla/mcp.json` loading the generated file inside a thread container (needs `claude auth login`).
- STDIO servers starting on a real thread machine (Test marks connect `null`).
- Codex TOML import covers a subset (strings, string arrays, inline tables, `[mcp_servers.x.env]`); OAuth discovery and dynamic client registration are not built.

## Devin Review round 1
- Fixed: scrub before truncating Test/OAuth errors; 10 s deadline on token requests; proposals reject literal text beside `${VAR}` (only `Bearer`/`Basic`/`Token` prefixes allowed); Codex `enabled = false` kept on import; a failed MCP apply reopens its approval; a failed MCP file copy removes the machine and fails the start.
- Escalated: Test/OAuth requests can reach private addresses from the server (SSRF). Self-hosted MCP servers on private networks are a real use, so an egress policy is an operator decision, not built here.
- `make check` after fixes: exit 0 (server 154 passed, 1 skipped; web 19 passed).
