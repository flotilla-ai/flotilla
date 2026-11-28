GOAL
Implement BEYOND-006: cited research report shape plus deterministic server-side checker that fails invented quotes and unfetched URLs.

BRANCH: flotilla/captain-09-citation-report
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-05 merged
SCOPE: `apps/server/src/research-report/**`, `apps/server/src/routes/research-report.route.ts`, `docs/runlog/captain-09.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No live search keys; no model-based fact checking; no UI beyond the one report render needed for verification.
SHAPES
Types: report JSON with `claims[]` (`text`, `label`, `sources[]` with `url`, `quote`, `fetchedHash`) and `unverified[]`; checker result with per-claim failures. Quote matching normalizes whitespace/case/quotes, exact substring first and 0.9 token-overlap fallback reported `fuzzy`.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/research-report/research-report.test.ts` passes; `make check` passes before merge.
EXPECTED
- Every measured claim requires at least one source.
- Quote must appear in stored fetched text; fuzzy matches are labelled.
- URL re-check uses HEAD then GET fallback and accepts only 2xx/3xx at report time.
- Inferred claims cite the claims they rest on.
- URLs never fetched fail.
- A liar fixture with an invented quote fails; a valid fixture passes.
- Failed reports render an unverified banner and cannot satisfy done evidence.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-006
