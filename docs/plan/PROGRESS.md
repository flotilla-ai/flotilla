# Flotilla progress

Current phase: phase1fix / planning phases 2-4.
Current `flotilla/p1` head at this branch start: `9e15b480ed6d8b7e4f2de1800382bd6f431589c4`.

## Row counts

Initialized in `docs/plan/PARITY.md`: P2/P3/P4 rows are pending; phase 1 rows are done except live vendor/GitHub rows marked `needs-human-login`; n/a rows carry Appendix A's reason.

## Unit table

| Unit | Status | Attempts | PR | Notes |
|---|---|---:|---|---|
| phase1 units 01-17 | merged | 1+ | see phase-1 summary below | compose, fake thread, cost and budget approval proven |
| plan-p234 | running | 1 | this PR | run rules, parity ledger, coverage script |
| phase1fix-01 | running | 1 | pending PR | scheduler restart recovery; real Postgres fake-clock restart test passes |
| phase1fix-02 | pending | 0 | | Captain five-crew fake relay |
| phase1fix-03 | pending | 0 | | egress/preview local fixtures |

## Next action

1. Merge this plan PR through the PR-only gate.
2. Merge phase1fix-01, then implement phase1fix-02.
3. Plan phase 2 only after the three fixes are merged.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None.

## Unverified items

See `docs/runlog/P1-EXIT.md`; live-service rows are enumerated in `docs/plan/PARITY.md` as `needs-human-login`.
