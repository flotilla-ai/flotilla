GOAL
Implement BEYOND-013: warm computer behavior, snapshot-first/caching, batch crew start, routine-model seam and timing instrumentation.

BRANCH: flotilla/captain-14-speed
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-05, captain-07 and captain-13 merged
SCOPE: `apps/server/src/captain-speed/**`, focused integration edits in captain crew/research/computer modules after dependency merge and unblock check, `evals/captain/timing/**` if needed, `docs/runlog/captain-14.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No paid/model calls; no waiting on unblock-12; no edits to unblock-owned background-model resolver.
SHAPES
Types for timing metrics (`wallMs`, tool count, model turns, cold start, warm wake, p50/p95), batch crew request/result and routine-model selection. Reuse unblock-12 resolver only if already merged; otherwise use a new read-only adapter over existing user model policy background model.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/captain-speed/captain-speed.test.ts` passes; `make check` passes before merge.
EXPECTED
- Computer remains warm while any Captain is active plus idle window; cold vs warm timings are recorded.
- Proxy defaults to text snapshot and uses screenshots only when asked/empty.
- `web.fetch` cache and 10-minute search-result cache are measured hit/miss.
- `crew.start_many` starts up to kernel crew limit in one call and coalesces completion wakes.
- Routine model selection is deterministic with fake adapter tests.
- Eval-facing metrics include wall time, tool-call count, model turns, cold start, warm wake, p50/p95.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-013
