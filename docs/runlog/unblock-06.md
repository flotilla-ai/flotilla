# unblock-06 issues web list

ROWS: CAPY-101, CAPY-102, CAPY-103, CAPY-107.

- CAPY-101: `#/issues` has For you / Assigned / Mentioned views plus status, assignee, label, due-date and relation filters. Filter behavior is unit-tested by `visibleIssues`.
- CAPY-102: issue detail edits due date/labels, adds relates/blocks/parent (sub-issue) relations and displays linked PRs/threads.
- CAPY-103: `POST /threads/:id/issues` files, updates and closes issues from an owning thread; filing links the thread. `POST /issues-web/:id/comments` creates a comment and queues a wake message to linked owning threads.
- CAPY-107: issue detail renders comments and timeline entries and links attached files to the existing download endpoint.

Screenshot: `docs/runlog/assets/unblock-06-issues.png` (Vite render without a backend; populated data unverified).

Verification (measured):
- `pnpm --filter @flotilla/web exec vitest run src/features/issues/issues.test.tsx` — 1 file, 2 tests passed.
- `pnpm --filter @flotilla/server exec vitest run src/issues-web/issues-web.test.ts` — 1 file, 1 test passed.
- web and server `tsc --noEmit` passed.

Unverified: browser end-to-end interaction with a live backend, real file upload before download. No paid API calls or vendor logins used.
