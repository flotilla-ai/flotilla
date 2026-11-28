# unblock-09 PR review mentions

ROWS: CAPY-134, CAPY-401, CAPY-403.

- CAPY-134: the PR page Review action posts the synced pull-request head SHA to `/api/v1/pr-mentions/review`; review runs started there use source `pr-page`. `@flotilla review <instructions>` starts a review with source `mention` and carries the instruction text.
- CAPY-401: `pullRequestAuthor` accepts the four commit identity options. Fixture commits in real temporary git repositories prove the expected author and `Co-authored-by` trailer for each option. Per-PR identity rows win over the repository-linked account default.
- CAPY-403: issue-comment webhooks for PRs parse `@flotilla` and `@capy`, add an eyes reaction through the GitHub client, and queue the message on the owning PR thread. Mention reviews use the synced PR head SHA.

Verification: focused server tests pass (4 files, 14 tests); focused web tests pass (1 file, 3 tests); server and web typecheck pass. Final `make check` output is pasted in the PR body. UI screenshot: `/tmp/unblock-09-pr-page.png` (backendless render of the PR action row).

Unverified: live GitHub reaction posting, live webhook delivery, and end-to-end browser behavior. No paid APIs or vendor logins used. Commit-author behavior is proven in fixture git repositories through the exported commit helper; there is no separate production commit engine in this unit.
