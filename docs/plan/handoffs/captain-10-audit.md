GOAL
Implement BEYOND-012: append-only `agent_audit` log and `#/audit` page showing tool/action decisions.

BRANCH: flotilla/captain-10-audit
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-04 merged
SCOPE: `apps/server/src/agent-audit/**`, `apps/server/src/routes/agent-audit.route.ts`, `apps/web/src/features/agent-audit/**`, route registration in `apps/web/src/main.tsx` only if no auto-registration seam exists, `docs/runlog/captain-10.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No retention deletion worker unless already supported by the seam schema; no pills; no unrelated UI edits.
SHAPES
Audit entries use the seam append-only table: time, user, thread, run, tool, scrubbed target, classification, decision, approval id. Web types mirror the API. Do not log raw secret-like values; scrub before insert.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/agent-audit/agent-audit.test.ts` passes; `pnpm --filter @flotilla/web exec vitest run src/features/agent-audit/agent-audit.test.tsx` passes; `make check` passes before merge; attach a UI screenshot.
EXPECTED
- Action gate allow/ask/deny decisions write audit rows.
- Entries include target URL/selector after scrubbing and link approval ids when present.
- Append-only behavior is tested (no update/delete API).
- `#/audit` renders a greys/black table with user, thread, tool, classification, decision and time; orange only when a row needs the user.
- Retention setting is displayed or explicitly marked not implemented in the runlog if outside budget.
DIFF BUDGET: <= 13 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-012
