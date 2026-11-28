# unblock-02 web composer queue

Rows: CAPY-009, CAPY-010, CAPY-026, CAPY-467, CAPY-468 (all `done`).

- `apps/web/src/features/thread-composer/queue-model.ts`: pure helpers (fold, state label, version groups, meter).
- `queue.tsx`: `QueuePanel`, `SentMessage`, `ContextMeter`, mounted by `ThreadComposer`.
- The composer now takes the file id from `POST /files` before the PUT finishes, so a message can be sent during the upload.

Measured: `pnpm exec vitest run src/features/thread-composer` (13 passed); `pnpm exec playwright test e2e/composer-queue.spec.ts e2e/thread-composer.spec.ts` (10 passed, API route-intercepted); `make check` exit 0.

Unverified:
- No browser run against the real server; the e2e specs intercept `/api/v1`. Playwright specs are not part of `make check` or CI (measured: the `test` script runs vitest only).
- CAPY-010: the server starts a new session for the new version (no adapter rewind); the UI hides older versions behind the switcher but does not hide the replies that followed them.
- CAPY-026: no org-level default UI; the default is the server env value.
- `e2e/drive-core.spec.ts` (CAPY-276) fails on `flotilla/p1` without this change (measured with the change stashed); not touched here.
- CAPY-467: a reload while the file bytes are still being sent aborts the browser PUT; the message then stays `waiting for upload` until the user discards or returns it (no resumable upload).
- A queued message edited or discarded before delivery still shows its original text in the transcript: the server appends `user.message` at enqueue time and emits no event on edit or cancel. Needs a server change (out of this unit's web scope).
- Return to composer keeps the message's attachment ids (shown as a count, names are not known to the queue view).
