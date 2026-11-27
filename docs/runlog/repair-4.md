# repair-4: secrets hardening

## Scope

Post-merge review repair for PR #28 escalations:

1. Persist the generated local KMS master key across compose server container replacement.
2. Key idempotency fingerprints so database readers cannot brute-force low-entropy request fields.

Explicitly not changed: short/user-repeated secrets in prompts. The decision is logged in `docs/plan/DECISIONS-LOG.md`: decrypting saved values at message time conflicts with CAPY-385, and removing the short-value floor can over-redact ordinary text.

## Changes

- `docker-compose.yml`: added named volume `secrets` mounted at `/run/secrets`; `FLOTILLA_MASTER_KEY_FILE` already points to `/run/secrets/master_key`.
- `apps/server/src/api-platform/http.ts`: fingerprints are HMAC-SHA256 keyed by the vault master key when configured, otherwise a process-local random key.
- `apps/server/src/api-platform/api-platform.test.ts`: proves stored fingerprints are not raw SHA-256 canonical-body hashes while replay/conflict behavior still works.
- `docs/plan/PROGRESS.md`: records PR #28 merged and this repair.

## Verification

```text
$ cd apps/server && npx vitest run src/api-platform --reporter=dot
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

```text
$ docker compose config
FLOTILLA_MASTER_KEY_FILE: /run/secrets/master_key
...
- type: volume
  source: secrets
  target: /run/secrets
```

```text
$ make check
apps/server test:  Test Files  14 passed (14)
apps/server test:       Tests  62 passed | 1 skipped (63)
pnpm -r lint: exit 0
make check: exit 0
```

## Unverified

- A live compose replacement drill (create secret, replace server container, decrypt again) was not run in this repair; the compose model now validates the persistent volume wiring.
- Cross-replica idempotency replay remains unavailable when neither master-key setting is configured; compose configures the persistent file.
