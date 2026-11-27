# phase3-20: public review rules and filters API

Focused verification:

```text
✓ src/api-review-rules/api-review-rules.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

TypeScript verification:

```text
pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json
exit 0
```

Dispositions: CAPY-622 through CAPY-634 are done.

Implemented: owner-scoped durable CRUD for review rules, path-scoped review filter rules, and review ignore paths with validation, conflict handling and repo filtering. No live external service is involved.
