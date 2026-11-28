# unblock-04 web settings/models

ROWS: CAPY-043, CAPY-050, CAPY-332, CAPY-485.

- CAPY-043: `/wake-settings` renders React / Keep as context / Ignore for every wake kind, with a personal form and an admin-only Org tab backed by `PUT /wake-settings/{me,org}`.
- CAPY-050: paired-device placement now enables `hold_incoming` automatically (including `deviceId` at thread creation); the thread view lists held messages with owner-only Allow/Decline controls through the existing API.
- CAPY-332: the model picker shows subscription/key/credits text, connection-name tooltips and Alt+1..9 favorite shortcuts; New thread uses the selected adapter/model/connection.
- CAPY-485: `/connections` edits Base URL, rejects non-http(s) input inline, saves through `PATCH /connections/:id` and reloads the saved value.

Verification (measured):
- `pnpm --filter @flotilla/web exec vitest run src/features/wake-settings/wake-settings.test.tsx src/features/model-picker/model-picker.test.tsx src/features/connections/connections.test.tsx` — 3 files, 4 tests passed.
- `pnpm --filter @flotilla/server exec vitest run src/device-execution/device-execution.test.ts` — 1 test passed.
- server and web `tsc --noEmit` passed.

Unverified: live paired-device execution, real vendor connection behavior, browser end-to-end interaction. No paid API calls or vendor logins used.
