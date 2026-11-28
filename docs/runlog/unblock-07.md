# unblock-07 issues web board

ROWS: CAPY-104, CAPY-105, CAPY-106, CAPY-496.

- CAPY-104: `#/issues-board` renders one column per state; cards support drag and ArrowLeft/ArrowRight moves, checkbox bulk move and Undo. Undo also PATCHes the prior states back to the API.
- CAPY-105: saved views are stored per user in Postgres, listed, saved and reapplied; issue titles edit in place; comments have in-place edit and reply endpoints/components.
- CAPY-106: custom states, ordering/default controls, labels and prefix controls call the existing admin issue APIs; the public API fixture proves new issues use the prefix.
- CAPY-496: Display menu groups/orders rows and hides properties; comment text renders `skill:x`, `pr:x` and `file:x` tags as links.

Verification (measured):
- `pnpm --filter @flotilla/web exec vitest run src/features/issues-board/issues-board.test.tsx` — 1 file, 3 tests passed.
- `pnpm --filter @flotilla/server exec vitest run src/issues-web/issues-web.test.ts src/api-issues/api-issues.test.ts` — 2 files, 4 tests passed.
- web and server `tsc --noEmit` passed.
- `make check` — passed (`check=0`); final lint completed with only the pre-existing unused-variable warning in `src/captain-ops/index.ts`.

Screenshot: attached to the PR (backendless Vite render). Unverified: browser end-to-end with a live backend and actual drag events. No paid API calls or vendor logins used.
