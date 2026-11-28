# unblock-10 agent tools

ROWS: CAPY-062, CAPY-070, CAPY-190, CAPY-317.

- CAPY-062: run-token MCP tools `sibling.create` and `sibling.message` are available to non-Captain child threads. Creation uses the calling thread's owner/project/parent; messages require the same owner and same non-null parent.
- CAPY-070: `captain.create` accepts a name from the calling agent, creates a draft thread owned by the caller, and atomically promotes it with Captain metadata/defaults.
- CAPY-190: `environment.read` and `environment.replace` are exposed in `tools/list` and forwarded to the existing environment tool implementation using only the calling thread's project; a supplied different `projectId` is refused.
- CAPY-317: `mcp.propose` is exposed in `tools/list` and delegates to the same `McpStore.propose` implementation as `POST /threads/:id/mcp/proposals`, preserving the in-thread approval card behavior.

Verification: focused captain-tool tests pass (2 files, 4 tests); server typecheck passes. Final `make check` output is pasted in the PR body.

Unverified: a live agent invoking the tools inside a real machine, live MCP client behavior, and production database end-to-end creation. Tests use local mocks; no paid APIs or vendor logins used.
