# phase2-21 Captain machine, profile and API

## Dispositions

- done: CAPY-094, CAPY-492, CAPY-493, CAPY-555, CAPY-556, CAPY-557, CAPY-558, CAPY-559, CAPY-560, CAPY-561
- blocked: CAPY-091 — Captains default to pool placement, but paired-device Captain execution is unavailable because no paired-device plane exists.
- blocked: CAPY-092 — pool placement and per-thread machine-name metadata exist, but cloud-vs-device selection fails closed because paired devices are unavailable.

## Proof

Focused tests:

```text
Test Files  2 passed (2)
Tests  2 passed (2)
```

The focused test proves Captain create/list/get, concurrency validation, crew-thread creation, add/list/remove crew, digest retrieval, alias validation, photo library selection, bounded png upload/download, default pool placement, device fail-closed behavior and per-crew machine-name metadata. The pre-existing captain crew regression test also passes.

## Unverified

Real Captain machine sleep/wake placement is covered only as metadata in this unit; paired devices do not exist yet. Photo rendering in a web page is not implemented here because this unit's rows are API/profile behavior.

Full verification after review-ready implementation:

```text
Test Files  37 passed (37)
Tests  242 passed | 1 skipped (243)
apps/server lint: Done
CHECK_RC=0
```
