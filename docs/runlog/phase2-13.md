# phase2-13: Machine UX and networking

ROWS: CAPY-214, CAPY-215, CAPY-477, CAPY-478, CAPY-479

## Implemented

- Migration `0031_machine_ux.sql`: per-thread network posture and durable background command rows.
- `MachineUxStore` plus machine routes:
  - public/private/OIDC network posture metadata; OIDC fails closed unless `FLOTILLA_OIDC_ISSUER` is configured;
  - `POST /threads/:id/machine/resize` changes machine size, sleeps the old idle container without deleting its workspace volume and boots a fresh machine;
  - sleeping workspace file list/read through the persisted volume, never through the sleeping lease;
  - web shell execution with durable automatic backgrounding and stop/list APIs;
  - desktop action fails closed because pool machines do not run a desktop server.
- `DockerMachineDriver` workspace readers use a networkless read-only helper container against `flt-workspace-<thread>`; they do not wake or start the thread machine.
- `/machine` + menu now exposes web shell/desktop actions, network selection, sleeping files and background command state. No SSH is used for pool shell access.

## Proof

Focused server test:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

Focused web test:

```text
Test Files  1 passed (1)
Tests  3 passed (3)
```

## Row disposition

- done: CAPY-214, CAPY-477, CAPY-478, CAPY-479
- blocked: CAPY-215 — the web shell/no-SSH half is implemented and proven, but pool machines do not run a desktop server, so the desktop half fails closed with 409.

## Unverified

The Docker read-only workspace helper is implemented but the focused proof uses the fixture workspace driver; run it against a real sleeping pool machine with `GET /api/v1/threads/<thread>/machine/files`. OIDC posture is a fail-closed configuration gate only; no external OIDC/Tailscale login was performed.
