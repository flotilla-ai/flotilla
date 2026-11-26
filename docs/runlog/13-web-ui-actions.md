# 13 Web UI actions

Implemented feature-folder Needs-you approval actions, new-thread form, project trust confirmation, and queue/interrupt/stop composer. Fixed route paths, approval endpoint, nullable blank budgets, project trust confirmation, and micro-USD budget payload.

Verification:
```text
$ pnpm --filter @flotilla/web test:e2e -- features
6 passed
```
Unverified: live Docker-backed browser screenshot and backend SSE interactions remain unverified.
