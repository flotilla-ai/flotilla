# captain-05 runlog

## Result

Implemented `web.search` behind a `SearchProvider` interface and cached readable `web.fetch` for BEYOND-005:

- fixture-backed HTTP search provider; no search-engine HTML scraping and no SearXNG
- gate abstraction runs before fetch
- readable text extraction strips scripts/styles/tags
- content is fenced with `fenceUntrusted`
- cache entries key URL + ETag/Last-Modified and store text by SHA-256 content hash
- unexpired TTL entries avoid another fetch; post-TTTL validator changes create a new generation
- live Brave/Exa/Tavily are configuration-only and remain `needs-human-login` with `FLOTILLA_SEARCH_PROVIDER` / `FLOTILLA_SEARCH_API_KEY_FILE`; no live provider keys were used

## Test output

```text
pnpm --filter @flotilla/server exec vitest run src/research/research.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

pnpm -r typecheck
exit 0

make check
exit 0
```
