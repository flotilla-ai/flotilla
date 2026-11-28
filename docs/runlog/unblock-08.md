# unblock-08 PR page wiring

ROWS: CAPY-111, CAPY-112, CAPY-113, CAPY-114, CAPY-126.

- CAPY-111: `/api/v1/pr-page/draft-choice` stores a per-repo/head-branch draft override; `/pr-page/open` applies it ahead of personal/org defaults when creating a PR through the injected gateway.
- CAPY-112: the Open in Flotilla preference controls whether creation follows up by appending an Open in Flotilla link to the PR body.
- CAPY-113: `#/pull/<owner>/<repo>/<n>` renders the PR page; command-palette resolution handles GitHub URLs, `owner/repo#n` and titles.
- CAPY-114: Chat/New thread with PR creates a thread whose first prompt contains PR number, title, head branch and URL.
- CAPY-126: idle sidebar rows show Checks / PR failing / PR ready from pull data.

Verification: focused Postgres fixture and web tests pass; exact output is in the PR body. `make check` passed (`check=0`). Screenshot attached to PR (backendless Vite render). Unverified: live GitHub creation/update behavior and browser end-to-end. No paid API calls or vendor logins used.
