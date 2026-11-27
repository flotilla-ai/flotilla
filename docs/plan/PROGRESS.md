# Flotilla progress

Current phase: phase 2, wave 6 (knowledge and integrations) in parallel with earlier waves.
Current `flotilla/p1` head: `505d663` (phase2-08 merged).

## Row counts

Counted in `docs/plan/PARITY.md` on this branch: done 90, pending 495, needs-human-login 14, n-a 22, blocked 11 (phase2-29 adds 5 done rows and CAPY-181 needs-human-login; phase2-05 adds 4 done rows and 10 blocked web-UI rows; phase2-08 adds 11 done rows; the remaining P2/P3/P4 rows are pending); phase 1 rows are done except live vendor/GitHub rows marked `needs-human-login`; n/a rows carry Appendix A's reason.

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
| repair-4-secrets-hardening | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/29 | persist vault key; keyed idempotency fingerprints |
| phase2-03-models-catalog | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/30 | model catalog + connections; 2 rows done, 5 needs-human-login, 1 blocked (CAPY-332 web picker) |
| phase2-07-thread-lifecycle | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/31 | thread lifecycle and collaboration; 11 rows done; see `docs/runlog/phase2-07.md` |
| repair-5-runner-supervise | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/33 | runner background continuations drained before pool end |
| phase2-05-runner-queue | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/34 | durable inbox, steer/queue, versions, retry, /plan gate; 4 rows done, 10 web-UI rows blocked |
| repair-6-git-hook-test | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/35 | isolate git hook test from external scans |
| phase2-08-thread-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/37 | public REST verbs + status frames for 11 lifecycle rows; collaborator read access; see `docs/runlog/phase2-08.md` |
| phase2-29-projects | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/42 | repoless/lazy/multi-repo projects, descriptions, codes, sources, private; 5 rows done, CAPY-181 needs-human-login; see `docs/runlog/phase2-29.md` |

## Next action

1. Finish phase2-29 review.
2. Continue wave 1 serialized foundations in order with phase2-04 after phase2-03.
3. Wave 2 units may start after wave 1 dependencies merge.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None.

## Unverified items

See `docs/runlog/P1-EXIT.md`; live-service rows are enumerated in `docs/plan/PARITY.md` as `needs-human-login`. Unverified items for phase2-01, phase2-02, phase2-05, phase2-07, phase2-08 and phase2-29 are listed in `docs/runlog/phase2-01.md`, `docs/runlog/phase2-02.md`, `docs/runlog/phase2-05.md`, `docs/runlog/phase2-07.md`, `docs/runlog/phase2-08.md` and `docs/runlog/phase2-29.md` (phase2-05 web UI display is not built).
