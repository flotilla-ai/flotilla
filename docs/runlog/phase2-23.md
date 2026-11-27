# phase2-23: pull requests and autofix

Focused verification:

```text
✓ src/pr-autofix/pr-autofix.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)

✓ src/features/pr-autofix/pr-autofix.test.tsx (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

Dispositions:

- done: CAPY-110, CAPY-120, CAPY-125
- needs-human-login: CAPY-115, CAPY-117, CAPY-123
- blocked: CAPY-111, CAPY-112, CAPY-113, CAPY-114, CAPY-126

Live GitHub verification command after connecting a real installation: create a test PR, then exercise `POST /api/v1/pulls/<owner>/<repo>/<n>/actions` for merge/comment/update-branch/auto-merge and `POST /api/v1/pulls/<owner>/<repo>/<n>/review` for comment/request-changes/approve, confirming actor identity in GitHub. Until then the production gateway fails closed instead of pretending mutations succeeded.
