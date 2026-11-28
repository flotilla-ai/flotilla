GOAL
Implement BEYOND-005: `web.search` behind a SearchProvider interface with a mock provider, plus cached readable `web.fetch` stored by hash and fenced as untrusted.

BRANCH: flotilla/captain-05-research-fetch-search
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams and captain-02 fixtures merged
SCOPE: `apps/server/src/research/**`, `apps/server/src/routes/research.route.ts`, `docs/runlog/captain-05.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No search-engine HTML scraping, no SearXNG, no live provider keys, no citation checker/report (captain-09).
SHAPES
Define `SearchProvider`, `SearchResult`, `FetchResult`, `FetchedText` types first. Live providers are configuration-only stubs marked `needs-human-login`. Fetch extraction may use existing permissive dependencies or add only MIT/Apache/BSD/ISC dependencies after license check. Cache key includes URL plus ETag/Last-Modified; stored text is content-addressed by hash.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/research/research.test.ts` passes against captain fixtures; `make check` passes before merge.
EXPECTED
- `web.search` calls the provider interface and mock provider returns fixture-web results.
- `web.fetch` goes through the gate abstraction, extracts readable text, caches for `FLOTILLA_FETCH_TTL_MIN`, stores by hash, and returns fenced untrusted text.
- A second fetch inside TTL uses cache; changed ETag/refetch stores a new hash.
- No direct HTML scraping of search engines and no SearXNG dependency.
- Live Brave/Exa/Tavily setup remains `needs-human-login` with exact env/file names documented in the runlog.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-005
