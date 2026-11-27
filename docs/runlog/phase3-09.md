# phase3-09: workspace plans and usage analytics

Focused verification:

```text
✓ src/usage-analytics/usage-analytics.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

```text
✓ src/features/usage-analytics/usage-analytics.test.tsx (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

TypeScript verification:

```text
server and web tsc --noEmit: exit 0
```

Dispositions: CAPY-350, CAPY-354, CAPY-355 and CAPY-487 are done.

Implemented: Personal/Team workspace reporting without billing, admin/member activity analytics derived only from metadata, merged/contributed PR and review-found-issue counts, agent hours, member cost/token ranking with cached tokens reported separately, and a real usage analytics web page. No live external service is involved.
