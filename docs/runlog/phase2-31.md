# phase2-31: Drive UX and sharing

## Implemented

- `drive_shares` Postgres table; only SHA-256 token hashes are persisted. Share creation returns the token once; links are anonymous capabilities with `read` or `write` access and can be revoked. The `/drive` page includes a Shared links view with revoke actions.
- Anonymous share-content route loads before authenticated routes (`0-drive-share.route.ts`) because the file-convention loader applies auth to later `/api/v1` routes.
- Drive files can be edited from the thread page side pane. Markdown files show a heading outline.
- Concurrent append-only edits merge deterministically as current content followed by the incoming append; non-append edits still return conflict.
- Version contents can be fetched individually; compare uses two selected versions in the UI and a server compare endpoint.
- Fast-engine proof measures 50 files copied into a new-machine fake in under 1 second.

## Proof

Focused red-first run before implementation:

```text
red:1
Tests  2 failed | 1 passed | 9 skipped (12)
```

Focused green:

```text
web: Tests 2 passed (2)
server: Tests 12 passed (12)
```

Full gate: `make check` exit 0; server 32 files, 233 passed, 1 skipped; web 11 files, 25 passed; typecheck and lint passed. A first full run hit the pre-existing concurrent machine-core readiness flake, and the focused machine-core file passed immediately when rerun (11/11); the second full run passed.

## Unverified

- Real browser interaction and real Docker machine timing are unverified; the <1 s proof uses the Drive mount seam and fake machine copy transport.
- Write-share edits are attributed to the share creator as uploads; there is no anonymous identity model.
