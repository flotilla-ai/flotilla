# unblock-06 issues web list

ROWS: CAPY-101, CAPY-102, CAPY-103, CAPY-107.

- CAPY-101: `#/issues` has For you / Assigned / Mentioned views plus status, assignee, label, due-date and relation filters. Filter behavior is unit-tested by `visibleIssues`.
- CAPY-102: issue detail edits due date/labels, adds relates/blocks/parent (sub-issue) relations and displays linked PRs/threads.
- CAPY-103: `POST /threads/:id/issues` files, updates and closes issues from an owning thread; filing links the thread. Agents also receive built-in MCP tools `issue.file`, `issue.update` and `issue.close` through the run-scoped Flotilla MCP config. `POST /issues-web/:id/comments` creates a comment and queues an untrusted kernel wake message only to linked threads whose owner created the link.
- CAPY-107: issue detail renders comments and timeline entries and links attached files to the existing download endpoint.

Screenshot: attached to PR #101 (Vite render without a backend; populated data unverified).

Verification (measured):
- `pnpm --filter @flotilla/web exec vitest run src/features/issues/issues.test.tsx` — 1 file, 2 tests passed.
- `pnpm --filter @flotilla/server exec vitest run src/issues-web/issues-web.test.ts src/captain/tools/captain-tools.test.ts` — 2 files, 4 tests passed.
- `pnpm --filter @flotilla/server exec vitest run src/api-issues/api-issues.test.ts` — 1 file, 1 test passed, including rejection of a thread link owned by another user.
- web and server `tsc --noEmit` passed.
- `make check` passed after the review fixes (`check=0`).

Unverified: browser end-to-end interaction with a live backend, real file upload before download. No paid API calls or vendor logins used.
