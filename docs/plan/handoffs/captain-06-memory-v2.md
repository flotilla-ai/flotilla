GOAL
Implement BEYOND-008: agent memory tools with scopes, deterministic retrieval, automatic work log, stale warning and secret refusal.

BRANCH: flotilla/captain-06-memory-v2
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `apps/server/src/memory-v2/**`, `apps/server/src/routes/memory-v2.route.ts`, `docs/runlog/captain-06.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. Do not edit existing memory experiment behavior for plain threads; no embeddings or model calls; no UI memory tab unless it fits in budget as a new feature path.
SHAPES
Types: scope `captain|user`, kind `preference|rule|fact|worklog`; memory entries use the seam migration columns. Retrieval is deterministic BM25-style term overlap plus all rules. Automatic worklog entries are typed run summaries. Secret-like input is rejected before storage using the existing scrubber plus password/card/OTP shapes.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/memory-v2/memory-v2.test.ts` passes; `make check` passes before merge.
EXPECTED
- `/mcp/memory` exposes `memory.save`, `memory.list`, `memory.forget` with per-run token authorization.
- Captain scope is isolated per Captain; user scope is shared by that user's Captains.
- Retrieval injects top-k relevant entries plus every rule and always includes `memory may be stale; re-check changing facts`.
- Run end writes dated worklog entries with title, outcome and links.
- Saving a password/card/OTP-shaped or scrubber-hit string is refused and not stored.
- Captain memory works independent of the plain-thread Memory experiment flag; log that decision.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-008
