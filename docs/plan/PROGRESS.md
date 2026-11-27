# Flotilla progress

Current phase: phase 2, wave 1 (serialized foundations).
Current `flotilla/p1` head at this branch start: `366c7bb46bf783fdb685c0e7e110d650eeb04df3`.

## Row counts

Initialized in `docs/plan/PARITY.md`: P2/P3/P4 rows are pending; phase 1 rows are done except live vendor/GitHub rows marked `needs-human-login`; n/a rows carry Appendix A's reason.

## Unit table

| Unit | Status | Attempts | PR | Notes |
|---|---|---:|---|---|
| phase1 units 01-17 | merged | 1+ | see phase-1 summary below | compose, fake thread, cost and budget approval proven |
| plan-p234 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/19 | run rules, parity ledger, coverage script |
| phase1fix-01 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/20 | scheduler restart recovery; real Postgres fake-clock restart test passes |
| phase1fix-02 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/21 | Captain five-crew fake relay |
| phase1fix-03 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/22 | egress/preview local fixtures |
| plan2 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/23 | 37 phase-2 handoffs covering 353 P2 rows exactly once |
| phase2-01-api-platform | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/25 | API platform foundation; 10 rows done |
| repair-2-runner-authz | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/26 | runner ownership/idempotency security repair |
| phase2-02-secrets | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/28 | secrets vault + env API; 12 rows done |
| repair-4-secrets-hardening | in progress | 1 |  | persist vault key; keyed idempotency fingerprints |
| phase2-03-models-catalog | in progress | 1 |  | child session implementing |
| phase2-07-thread-lifecycle | in review | 1 |  | thread lifecycle and collaboration; 11 rows done pending merge; see `docs/runlog/phase2-07.md` |

## Next action

1. Merge repair-4-secrets-hardening, then review the phase2-03 child PR.
2. Continue wave 1 serialized foundations in order with phase2-04 after phase2-03.
3. Wave 2 units may start after wave 1 dependencies merge.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None.

## Unverified items

See `docs/runlog/P1-EXIT.md`; live-service rows are enumerated in `docs/plan/PARITY.md` as `needs-human-login`. phase2-01, phase2-02 and phase2-07 unverified items are listed in `docs/runlog/phase2-01.md`, `docs/runlog/phase2-02.md` and `docs/runlog/phase2-07.md`.
