# phase1fix-03: egress and preview fixtures

GOAL: prove live egress-gate and preview traffic with local fixtures: a local HTTP server acts as the internet; allowlisted traffic passes, non-allowlisted/public-IP traffic is denied, and preview bearer/no-token/UI-cookie behavior is correct.

BRANCH: flotilla/phase1fix-03-egress-preview
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase1fix-02-captain-relay

SCOPE:
- `apps/gate/`
- `apps/server/src/gateClient/`
- `apps/server/src/previews/`
- `scripts/test-egress-preview-e2e.sh`
- `docker-compose.yml`
- `docs/plan/handoffs/phase1fix-03-egress-preview.md`
- `docs/runlog/phase1fix-03.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

DONE SIGNAL:
```sh
./scripts/test-egress-preview-e2e.sh
make check
```

EXPECTED: real network traffic through the gate/container path, not only policy unit tests; preview bearer gets 200, missing bearer gets 401, and a UI session cookie is rejected on the preview origin.

ROWS: CAPY-220, CAPY-222
