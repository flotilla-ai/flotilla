# Flotilla progress

Current phase: phase 2, waves 3-6 running in parallel through child sessions.
Current `flotilla/p1` head before this PR: `6b5546a` (repair-10; phase2-17 and repair-12 already merged).

## Row counts

Counted in `docs/plan/PARITY.md` on this branch after repair of seven malformed phase1fix ledger rows: done 126, pending 449, needs-human-login 17, n-a 22, blocked 25.

## Unit table

| Unit | Status | Attempts | PR | Notes |
|---|---|---:|---|---|
| phase1 units 01-17 | merged | 1+ | see phase-1 summary below | compose, fake thread, cost and budget approval proven |
| plan-p234 / plan2 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/19 / https://github.com/flotilla-ai/flotilla/pull/23 | run rules, parity ledger, 37 phase-2 handoffs |
| phase1fix-01..03 | merged | 1 each | https://github.com/flotilla-ai/flotilla/pull/20 / https://github.com/flotilla-ai/flotilla/pull/21 / https://github.com/flotilla-ai/flotilla/pull/22 | scheduler recovery, Captain relay, egress/preview fixtures |
| phase2-01-api-platform | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/25 | API platform foundation |
| repair-2-runner-authz | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/26 | runner ownership/idempotency security repair |
| phase2-02-secrets | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/28 | secrets vault + env API |
| repair-4-secrets-hardening | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/29 | persistent vault key; keyed idempotency fingerprints |
| phase2-03-models-catalog | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/30 | model catalog + connections |
| phase2-07-thread-lifecycle | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/31 | thread lifecycle and collaboration |
| repair-5/6 | merged | 1 each | https://github.com/flotilla-ai/flotilla/pull/33 / https://github.com/flotilla-ai/flotilla/pull/35 | runner drain and isolated git hook test |
| phase2-05-runner-queue | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/34 | durable inbox/queue/plan gate |
| phase2-08-thread-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/37 | public thread verbs/status frames |
| phase2-09-previews | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/32 | preview lifecycle/sharing |
| phase2-04-model-policy-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/36 | model policy + run-out |
| repair-7/8/9 | merged | 1 each | https://github.com/flotilla-ai/flotilla/pull/38 / https://github.com/flotilla-ai/flotilla/pull/41 / https://github.com/flotilla-ai/flotilla/pull/43 | archived CI dormancy, vendor CLIs, runner test race |
| phase2-10-environments | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/39 | environment versions/process seams |
| phase2-06-thread-composer | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/40 | composer/requests/reading/feedback draft |
| phase2-17-wakes | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/45 | wake router/timers/inbox; jobs await machine executor |
| repair-10 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/46 | feedback drafts bypass generic answers |
| repair-12 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/49 | archived timer regression synchronization |
| phase2-29-projects | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/42 | repoless/lazy projects, descriptions, codes, sources; CAPY-181 needs-human-login, CAPY-182 blocked |
| repair-11-first-attachments | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/47 | first-prompt attachment plumbing and validation |
| phase2-18-subagent-core | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/44 | subagent core under review |
| phase2-12-machine-core | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/48 | machine leases/sleep/wake under review |
| phase2-11-snapshots | in review | 1 | https://github.com/flotilla-ai/flotilla/pull/50 | snapshots under implementation/review |

## Next action

1. Merge repair-11 when green, then phase2-29 after CI/review rerun on this integration merge.
2. Merge phase2-18 and phase2-12 only after their review findings are triaged; phase2-11 follows machine core.
3. Continue Captain/work-surface units after subagent and machine dependencies settle.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None as whole units. Row-level blocked items are recorded in `docs/plan/PARITY.md` and unit runlogs.

## Unverified items

See `docs/runlog/P1-EXIT.md` and phase-2 runlogs. Live vendor, GitHub, device, paired-machine and vendor-login behavior remains `needs-human-login` or unverified where marked.
