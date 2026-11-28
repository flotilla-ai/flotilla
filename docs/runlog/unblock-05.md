# unblock-05 web captain/automations

ROWS: CAPY-067, CAPY-078, CAPY-098, CAPY-153, CAPY-495.

- CAPY-067: `/captains` has a New Captain dialog collecting name, face, project, machine, model and access. Missing name disables submit. The extracted create flow POSTs `/captains`, then applies the library face, pool placement and optional organization share.
- CAPY-078: `/pulls` has a Captain filter. The server list endpoint accepts `captain=<id>` and restricts rows to PRs whose threads are in that Captain crew.
- CAPY-098: `/captains` includes a persistent Captains-first / Hybrid sidebar mode. Pinned Captain faces sort first, Captain rows show the current waiting question label, and hybrid mode interleaves non-pinned rows by activity.
- CAPY-153: `/automations` lists automations, creates schedule automations, edits name/prompt/cron, pauses, resumes and deletes through the automation REST API.
- CAPY-495: crew lists use a fixed-height virtual list. A 500-row input mounts only a small DOM window and `scrollTopForRow` computes the offset needed for row 400.

Screenshots: `docs/runlog/assets/unblock-05-captains.png`, `docs/runlog/assets/unblock-05-automations.png` (Vite render without a backend; API-populated rows unverified).

Verification (measured):
- `pnpm --filter @flotilla/web exec vitest run src/features/virtual-list/virtual-list.test.tsx src/features/captain-ui/captain-ui.test.tsx src/features/automations/automations.test.tsx src/features/pr-autofix/pr-autofix.test.tsx` — 4 files, 9 tests passed.
- `pnpm --filter @flotilla/server exec vitest run src/pr-autofix/pr-autofix.test.ts` — 1 test passed.
- web and server `tsc --noEmit` passed.
- `make check` passed.

Unverified: browser end-to-end interaction; live paired-device machine placement is unavailable and the device choice is disabled; no paid API calls or vendor logins used.
