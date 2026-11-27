# phase3-01 thread media

ROWS: CAPY-028..031

Verification:
- `pnpm --filter @flotilla/server exec vitest run src/thread-media/thread-media.test.ts` — 1 passed
- `cd apps/web && pnpm exec vitest run src/features/thread-media/thread-media.test.tsx` — 1 passed
- server and web `tsc --noEmit` — passed

Implemented:
- CAPY-028: fenced `chart` visuals render inline as metered chart fixtures, fenced HTML renders in a sandboxed inline frame, and thread messages invoke the inline visual renderer.
- CAPY-030: durable pin/box media annotations with normalized coordinates, safe media URL validation, owner-scoped thread CRUD and overlay rendering helpers.
- CAPY-029 partial: Mermaid flowchart fixtures render inline in thread messages. The row remains blocked because Slack image posting does not exist.
- CAPY-031: `adapterVideoAudio` capability predicate exists, but the row remains blocked because there is no Gemini adapter or video/audio capability in the adapter contract.

Unverified: no browser e2e; Mermaid support is the fixture-backed flowchart subset, not the full Mermaid language.
