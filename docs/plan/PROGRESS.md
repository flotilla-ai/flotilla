# Flotilla progress

Current phase: phase 2, wave 1 (serialized foundations) and wave 2 (core threads and runner).
Current `flotilla/p1` head: `ea9ec15` (phase2-03, phase2-05, phase2-07, phase2-08 and phase2-09 merged; merged into phase2-04).

## Row counts

Counted in `docs/plan/PARITY.md` on this branch: done 124, pending 445, needs-human-login 16, n-a 22, blocked 25 (phase2-30 adds 9 done Drive rows and 1 blocked; phase2-05 adds 4 done rows and 10 blocked web-UI rows; phase2-08 adds 11 done rows; the remaining P2/P3/P4 rows are pending); phase 1 rows are done except live vendor/GitHub rows marked `needs-human-login`; n/a rows carry Appendix A's reason.

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
| repair-6-git-hook-test | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/35 | isolate git hook test from external scans |
| phase2-05-runner-queue | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/34 | durable inbox, steer/queue, versions, retry, /plan gate; 4 rows done, 10 web-UI rows blocked |
| phase2-08-thread-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/37 | public REST verbs + status frames for 11 lifecycle rows; collaborator read access; see `docs/runlog/phase2-08.md` |
| phase2-09-previews | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/32 | preview lifecycle and sharing; 7 rows done |
| phase2-04-model-policy-api | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/36 | model policy + model API; 2 rows done (335, 336), 3 needs-human-login (333, 337, 484), 2 blocked (338 no model-backed title/summary generator, 485 no web connections editor) |
| phase2-10-environments | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/39 | environments model/store/executor seams; 2 rows done, 7 blocked on phase2-11/phase2-12 wiring; see `docs/runlog/phase2-10.md` |
| phase2-17-wakes | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/45 | wake router, watches/timers, background jobs, cross-thread peek/send, held messages; 9 rows done, 4 blocked; see `docs/runlog/phase2-17.md` |

| phase2-30-drive-core | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/51 | Drive store, versions, quota, thread mount/write-back, failure cards, `/drive` page; 9 rows done, 1 blocked (CAPY-277 BYOM); see `docs/runlog/phase2-30.md` |
| phase2-06-thread-composer | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/40 | composer keymap/attachments, request cards + Undo, thread codes, sections/ticks/reading place, deep link, owner-approved feedback; 10 rows done; see `docs/runlog/phase2-06.md` |

## Next action

1. Review and merge phase2-04-model-policy-api (branched from `flotilla/p1` `914854c`, merged with `ea9ec15`).
2. Wave 1 serialized foundations are complete after phase2-04 merges.
3. Wave 2 units may start after wave 1 dependencies merge.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None.

## Unverified items

See `docs/runlog/P1-EXIT.md`; live-service rows are enumerated in `docs/plan/PARITY.md` as `needs-human-login`. Unverified items for phase2-01 through phase2-05 and phase2-07 through phase2-10 are listed in `docs/runlog/phase2-0{1,2,3,4,5,7,8,9}.md` `docs/runlog/phase2-10.md` `docs/runlog/phase2-17.md` and `docs/runlog/phase2-30.md` (phase2-05 web UI display is not built); phase2-04 live commands (`claude auth login`, `codex login`, GPT-6 context window, Base URL gateways) are in `docs/runlog/phase2-04.md`.
