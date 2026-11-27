# Flotilla progress

Current phase: phase 2, wave 1 (serialized foundations).
Current `flotilla/p1` head at this branch start: `daad0c8f1b76dd3424552802b69d837813658662`.

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
| phase2-02-secrets | in review | 1 | PR-pending | secrets vault + env API; 12 rows done |

## Next action

1. Review and merge phase2-02-secrets (branched from `flotilla/p1` head `daad0c8f1b76dd3424552802b69d837813658662`).
2. Continue wave 1 serialized foundations in order.
3. Wave 2 units may start after wave 1 dependencies merge.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None.

## Unverified items

See `docs/runlog/P1-EXIT.md`; live-service rows are enumerated in `docs/plan/PARITY.md` as `needs-human-login`. phase2-01 and phase2-02 unverified items are listed in `docs/runlog/phase2-01.md` and `docs/runlog/phase2-02.md`.
