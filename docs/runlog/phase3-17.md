# phase3-17: public folders, files, attachments and users API

Focused verification:

```text
✓ src/api-folders-files/api-folders-files.test.ts (1 test)
Test Files  1 passed (1)
Tests  1 passed (1)
```

Dispositions: CAPY-562, CAPY-563, CAPY-564, CAPY-565, CAPY-566, CAPY-567, CAPY-605, CAPY-606, CAPY-607 and CAPY-638 are done.

Implemented: folder list and folder thread listing derived from visible lifecycle threads; file/unfile and pin/unpin APIs using lifecycle events; byte-exact upload/list proof through the existing API platform; owner-scoped attachment download; non-service organization user listing. No live external service is involved.
