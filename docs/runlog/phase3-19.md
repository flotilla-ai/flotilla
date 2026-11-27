# phase3-19: public task aliases and reviews API

Focused verification:

```text
✓ src/api-tasks-reviews/api-tasks-reviews.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

TypeScript verification:

```text
pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json
exit 0
```

Dispositions: CAPY-596, CAPY-597, CAPY-598, CAPY-611, CAPY-612, CAPY-618, CAPY-619, CAPY-620 and CAPY-621 are done.

Implemented: legacy task list/get/messages aliases over owned and visible threads; stable public review settings, start, round, pull-state and batch finding-status endpoints over the durable review core. No live external service is involved.
