GOAL
Create the serialized seams needed by the Captain-quality and own-computer VM tracks, with no runtime behavior beyond additive schema/types/hooks.

BRANCH: flotilla/parallel-01-seams
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-00-plan merged
SCOPE: root `package.json`, `Makefile`, `docker-compose.yml`, `.env.example`, `apps/server/src/db/migrations/0500_captain_core.sql` and `0600_vms_core.sql` (or next free `05NN`/`06NN`), `apps/server/src/captain/tools/service.ts`, `apps/server/src/captain/tools/mcpConfig.ts`, `packages/core/src/kernel/fenceUntrusted.ts` plus its test, `.gitkeep` files in empty unit module folders, `docs/runlog/parallel-01-seams.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No implementation behavior in computer/research/memory/hostd modules.
SHAPES
Define additive tables only: `computers`, `computer_screens` if needed by the design, `agent_audit`, memory scope/kind columns, `compute_settings`, `computer_allocations`, nullable computer backend/owner columns. Do not rebuild `approvals_kind_check`; use approval kind `decision` with `detail.kind`. `fenceUntrusted(source,text)` returns nonce-fenced text and strips embedded nonce-shaped closers. Makefile targets may forward to scripts that do not exist yet only if they fail with a clear message when invoked before later units.
DONE SIGNAL
`pnpm -r typecheck` passes; `pnpm --filter @flotilla/core exec vitest run src/kernel/fenceUntrusted.test.ts` passes; migration SQL parses in the existing migrator test or a new focused test; `make check` passes before merge.
EXPECTED
- `.env.example` gains names only: `FLOTILLA_COMPUTER_MAX_SCREENS`, `FLOTILLA_COMPUTER_IDLE_MIN`, `FLOTILLA_FETCH_TTL_MIN`, `FLOTILLA_SEARCH_PROVIDER`, `FLOTILLA_SEARCH_API_KEY_FILE`, `FLOTILLA_EVAL_MODEL`, `FLOTILLA_COMPUTE_ISOLATION`, `FLOTILLA_HOSTD_SOCKET`, `FLOTILLA_HOSTD_TOKEN_FILE`, `FLOTILLA_HOST_RESERVE_RAM_MB`, `FLOTILLA_HOST_RESERVE_CPUS`, `FLOTILLA_HOST_RESERVE_DISK_GB`.
- Compose may gain build entries for `deploy/computer.Dockerfile` and `deploy/computer-isolated.Dockerfile`, but no always-on service.
- Run MCP config can mount `/mcp/computer`, `/mcp/research`, `/mcp/memory` behind per-run tokens without implementing those endpoints here.
- No behavior change when all new env vars are unset (measured by existing tests).
DIFF BUDGET: <= 15 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: none
