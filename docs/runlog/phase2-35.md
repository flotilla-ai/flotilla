# phase2-35: GitHub accounts and installations

ROWS: CAPY-399, CAPY-400, CAPY-401, CAPY-402, CAPY-403, CAPY-404, CAPY-405, CAPY-518

## Implemented

- Migration `0029_github_integration.sql`: GitHub accounts, installations and per-PR commit identities. Token values are not stored; `tokenRef` is an external vault reference only.
- `GitHubIntegrationStore` plus `/api/v1/github/*` routes:
  - connect/list multiple personal or organization accounts;
  - add/list installations with repository metadata and a dependency-reader flag;
  - validate the minimum installation permission set and refuse insufficient installations;
  - validate the four commit-author modes and per-PR overrides;
  - admin unlink revokes the account and installations; reconnecting preserves unspecified settings and can reattach a revoked installation.
- Review hardening: GitHub logins are case-insensitive, plaintext token values are rejected, installation ids cannot be squatted across accounts, and per-PR identities are user-scoped/installation-scoped.
- Regression: `apps/server/src/github-integration/github-integration.test.ts`.

## Proof

Focused test after implementation:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

## Row disposition

- done: CAPY-399, CAPY-405, CAPY-518
- needs-human-login: CAPY-400 — the API shape exists, but live OAuth/PAT verification and acting as the user on GitHub require a human-connected account. Operator command: connect a PAT/OAuth token, then run a fixture PR creation against a test repository.
- blocked: CAPY-401 (identity settings are not consumed by commit/PR creation), CAPY-402 (no managed GPG/signing path), CAPY-403 (no `@capy` command parser or eyes reaction), CAPY-404 (no read-only dependency-reader app/credential flow).

## Unverified

No live GitHub App installation, OAuth login, API write, mention reaction, signed commit or private dependency read was performed.
