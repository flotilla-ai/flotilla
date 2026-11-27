# phase2-14 Paired devices

## Dispositions

- done: CAPY-229, CAPY-230, CAPY-231
- blocked: CAPY-228 — pairing-code claim, bearer token issuance, owner approval and revocation are proven, but Google/GitHub sign-in and the real flotilla-runner desktop pairing flow are absent.
- blocked: CAPY-232 — devices carry `machineMetering: "none"`, but runner execution/billing does not yet place or meter threads on devices.
- blocked: CAPY-233 — central self-hosted APIs exist, but real device-local threads do not execute yet.
- blocked: CAPY-234 — device status and a 24 h `waitUntil` timestamp are durable, but runner placement does not yet wait for reconnect.
- blocked: CAPY-235 — the cloud-checkpoints setting is durable, but checkpoint capture/upload is not implemented.
- blocked: CAPY-236 — the move-to-cloud toggle is durable, but offline automatic migration is not implemented.
- blocked: CAPY-240 — the keep-awake setting is durable, but no runner power-management enforcement exists.

## Proof

Focused test:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

The test proves pairing-code single use/expiry shape, hash-only device token storage, pending trust exclusion, owner approval, machine picker cloud/device metadata, heartbeat/revocation fail-closed behavior, workspace policy validation and preservation, recursive fixture folder scanning by git origin remote, authenticated scan reports, and the 24 h wait timestamp.

## Unverified

No real desktop runner, OS power management, Tailscale transport, device-local execution, checkpoint capture, offline migration, or Google/GitHub OAuth flow exists in this unit.
