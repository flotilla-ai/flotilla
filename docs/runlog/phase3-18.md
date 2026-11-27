# phase3-18: public issues API

Focused verification:

```text
✓ src/api-issues/api-issues.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

TypeScript verification:

```text
pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json
exit 0
```

Dispositions: CAPY-568 through CAPY-592 are done.

Implemented: durable Postgres-backed public issues with list/create/get/update, comments, unified timeline, relations, pull-request/thread links, uploaded-file attachment and byte-exact download, custom state CRUD/reorder/default protection, label CRUD with reference cleanup, and configurable issue prefixes. No live external service is involved.
