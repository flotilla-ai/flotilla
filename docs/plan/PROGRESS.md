# Flotilla progress

Current phase: phase 2, waves 3-6 continuing in the parent session; child sessions are not used because free/SWE-2.1 child mode is unavailable.
Current `flotilla/p1` head: `79ff496` (phase2-13 machine UX/network).

## Row counts

Counted in `docs/plan/PARITY.md` at `79ff496`: done 216, pending 336, needs-human-login 19, n-a 22, blocked 43.

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
| phase2-29-projects | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/42 | repoless/lazy projects, descriptions, codes, sources; CAPY-181 needs-human-login, CAPY-182 blocked |
| repair-11-first-attachments | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/47 | first-prompt attachment plumbing and validation |
| phase2-18-subagent-core | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/44 | subagent drafts, placement, modes, budget slice, parent wake; 9 rows done (052-060), 2 blocked (061 no paired-device driver, 062 no agent-callable tool for non-Captain threads); see `docs/runlog/phase2-18.md` |
| phase2-33-skills | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/52 | skills discovery (built-in, repo `.agents`/`.claude`, Drive, plugin), mount into agent-native folders, `$`/`/`/`@`/words invocation + records, Not loaded / Replaced-by markers and web `#/skills`, copy-import; 7 rows done; see `docs/runlog/phase2-33.md` |
| phase2-12-machine-core | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/48 | machine leases/sleep/wake/RAM cap/billing; CAPY-206/207/212 blocked as recorded |
| phase2-11-snapshots | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/50 | snapshot build/scrub/history plus runner bootPlan wiring; all 6 rows done |
| phase2-30-drive-core | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/51 | Drive store, versions, quota, thread mount/write-back, failure cards, `/drive` page; 9 rows done, 1 blocked (CAPY-277 BYOM); see `docs/runlog/phase2-30.md` |
| phase2-31-drive-ux | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/56 | share links/access/shared view, thread side-pane editing, Markdown outline, append merge, version compare, sub-second mount proof; 4 rows done; see `docs/runlog/phase2-31.md` |
| phase2-36-usage-billing-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/54 | usage report/series/balance API, monthly org/project budget windows, machine-minute pricing, run-out free ask/forbid, `/usage` page; 9 rows done; see `docs/runlog/phase2-36.md` |
| phase2-32-rules | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/53 | layered rules loader, shared context budget, kernel rules, context breakdown, Memory/Captain experiments; 11 rows done; see `docs/runlog/phase2-32.md` |
| phase2-34-mcp | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/55 | MCP registry/plugins; rows/statuses in `docs/runlog/phase2-34.md` |
| phase2-20-captain-create-crew | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/62 | promote/add/archive/release crew API and ownership/project rules; 6 rows done, dialog/folder/ask/full lifecycle rows blocked; machine cleanup/deletion review hardening included; see `docs/runlog/phase2-20.md` |
| phase2-19-subagent-forks-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/60 | subagent list/get/messages plus subagent/task SSE APIs; 5 rows done, fork/side-chat rows blocked for missing workspace/session-copy primitive; see `docs/runlog/phase2-19.md` |
| phase2-37-support-docs | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/58 | troubleshooting guide/index covering all 12 required operator topics; CAPY-464 done; see `docs/runlog/phase2-37.md` |
| phase2-13-machine-ux-network | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/66 | network posture, resize/move, sleeping workspace reads, durable background commands; review-hardened workspace helper/process lifecycle; CAPY-214/477/478/479 done, CAPY-215 blocked for missing desktop server; see `docs/runlog/phase2-13.md` |
| phase2-35-github-integration | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/64 | account/installation fixture store, permission floor, commit identity settings, admin unlink; review-hardened reconnect/repository/user scoping; CAPY-399/405/518 done, CAPY-400 needs-human-login, CAPY-401/402/403/404 blocked; see `docs/runlog/phase2-35.md` |

## Next action

1. Continue machine UX/devices/dock and Captain/work-surface units directly in the parent session. CAPY-061/062 need a paired-device target and an agent-callable subagent tool.
2. Repair runner queue so failed starts requeue undelivered inbox items instead of dropping them.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None as whole units. Row-level blocked items are recorded in `docs/plan/PARITY.md` and unit runlogs.

## Unverified items

- phase2-36: machine cost uses runner type `pool` until phase2-12 machine core stamps sizes; no browser e2e for `/usage`; real vendor run-out detection (CAPY-333) still needs human login. See `docs/runlog/phase2-36.md`.

See `docs/runlog/P1-EXIT.md` and phase-2 runlogs (phase2-33: `docs/runlog/phase2-33.md`). Live vendor, GitHub, device, paired-machine and vendor-login behavior remains `needs-human-login` or unverified where marked.
