# 16 Captain tools

Implemented kernel crew-limit checks, hashed per-run token service, JSONRPC Streamable-HTTP-style `/mcp/captain` endpoint, five Captain tool handlers, Captain REST routes backed by the `captains` table, and runner integration that issues/revokes Captain run tokens, writes `/run/flotilla/mcp.json`, passes the MCP path to adapters, and scrubs the token from events.

Verification:
```text
$ pnpm --filter @flotilla/server exec vitest run src/captain/tools/captain-tools.test.ts
 Tests  2 passed (2)
$ make check
 exit 0
```

Unverified/gaps:
- Live Docker/gate relay execution is unverified.
- In-memory run-token storage does not survive server restart; phase-exit integration should decide whether restart recovery requires persistence.
- Captain-subtree accounting uses the captain row budget/spent approximation, not a complete recursive crew aggregate.

## Final integration fixes

Measured after review: run tokens survive only for one in-memory run, denial retries were added, Captain creation queues its first owner-scoped turn, no-project fake runs use `/workspace`, containers are removed after finalization, GitHub tokens are restricted to github.com remotes, and compose creates the `flotilla` database and installs `git` in the server runtime.
