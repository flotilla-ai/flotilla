# parallel-01-seams runlog

## Result

Implemented the serialized T2/T4 seam with no feature behavior:

- Additive migrations `0500_captain_core.sql` (`computers`, `computer_screens`, `agent_audit`, memory kind/captain columns) and `0600_vms_core.sql` (`compute_settings`, `computer_allocations`, nullable computer backend/owner-captain columns).
- `fenceUntrusted` in core, with nonce/randomness, attribute escaping and embedded-closer stripping tests.
- Run MCP config now seams `/mcp/computer`, `/mcp/research` and `/mcp/memory` beside `/mcp/captain` using the same per-run token.
- Makefile targets `computer-image`, `computer-isolated-image`, `eval-captain`, `eval-vms`; eval targets fail clearly until later units add their scripts.
- Compose has profile-gated build-only computer image entries; no always-on service.
- `.env.example` gained names only.
- Empty module folders were created with `.gitkeep` files.

## Test output

```text
pnpm --filter @flotilla/core exec vitest run src/kernel/fenceUntrusted.test.ts
Test Files  1 passed (1)
Tests  3 passed (3)

pnpm --filter @flotilla/server exec vitest run src/captain/tools/captain-tools.test.ts
Test Files  1 passed (1)
Tests  3 passed (3)

pnpm -r typecheck
passed for all workspaces

pnpm --filter @flotilla/server exec vitest run src/events/store.test.ts
Test Files  1 passed (1)
Tests  6 passed (6)

docker compose config --quiet
compose_config_ok
```

## Notes

- No new dependencies (measured).
- No secrets or env values added (measured: `.env.example` names only).
- Root workspace files were not edited because `pnpm-workspace.yaml` already includes `apps/*` and `packages/*` (decision logged).
- Real image builds are not part of this seam; later units add the Dockerfiles.
