# Flotilla progress

Current phase: unblock run (clearing the 199 rows that were `blocked` at `f08de2a`). Units run serially in the parent session (no child sessions: no free/SWE 2.1 child mode can be selected).
Last unit: unblock-02-web-composer-queue (merged). Unblock units merged or blocked: 2 of 52.
Unblock plan: `docs/plan/BLOCKED-TRIAGE.md`, `docs/plan/handoffs/README-unblock.md` (52 units).

## Row counts

Counted in `docs/plan/PARITY.md`: done 399, blocked 194, needs-human-login 24, n-a 22, pending 0. At the start of the unblock run: done 394, blocked 199, needs-human-login 24, n-a 22, pending 0.

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

| phase2-26-automations-core | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/68 | durable automation definitions, cron/webhook/GitHub/manual triggers, batches, conditions, model pinning and thread modes; 11 rows done, CAPY-153/163 blocked; see `docs/runlog/phase2-26.md` |
| phase2-21-captain-machine-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/69 | Captain list/create/get/crew/digest REST, crew-thread creation, alias/photo upload/library, pool placement metadata; 10 rows done, paired-device rows blocked; see `docs/runlog/phase2-21.md` |
| phase2-14-devices-pairing | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/70 | Pairing codes, device trust/status/heartbeat, machine picker, workspace policy, folder scan; 3 rows done, 7 device-execution rows blocked; see `docs/runlog/phase2-14.md` |
| phase2-27-automation-control | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/71 | automation control operations, cap, webhook rotation, filters; 4 rows done, Drive/machine/output rows blocked; see `docs/runlog/phase2-27.md` |
| repair-19-runner-requeue | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/72 | failed starts requeue claimed input instead of cancelling user messages |
| phase2-28-automation-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/73 | automation REST CRUD, run/batch controls, state transitions; see `docs/runlog/phase2-28.md` |
| phase2-23-pr-autofix | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/74 | PR settings/list/actions/review actor and no-CI wake foundation; see `docs/runlog/phase2-23.md` |
| phase2-24-review-core | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/75 | durable review rounds/findings/triage/readiness/posting policy; see `docs/runlog/phase2-24.md` |
| phase2-25-review-policy | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/76 | review context/policy/guides/evidence/stack detection; see `docs/runlog/phase2-25.md` |
| phase2-22-captain-ops | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/77 | Captain digest documents/rules/messages/actions/templates; see `docs/runlog/phase2-22.md` |
| phase2-16-dock-cli | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/78 | dock install verification/layout/dirs/commands/user isolation; see `docs/runlog/phase2-16.md` |
| phase2-15-device-execution | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/79 | device worktree policy/placement/Tailscale/import validation foundation; see `docs/runlog/phase2-15.md` |
| phase2-exit | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/80 | exit report, compose verify, missing projects ledger rows restored |
| plan3+4 | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/81 | exact handoff coverage for 192 P3 and 22 P4 rows |
| phase3-17-api-folders-files | merged | 1 | #82 | public folders/pins/files download/users API; see `docs/runlog/phase3-17.md` |
| phase3-18-api-issues | merged | 1 | #84 | public issues API; see `docs/runlog/phase3-18.md` |
| phase3-20-api-review-rules | merged | 1 | #86 | public review rules API; see `docs/runlog/phase3-20.md` |
| phase3-19-api-tasks-reviews | merged | 1 | #85 | tasks/reviews API; see `docs/runlog/phase3-19.md` |
| phase3-09-billing-usage | merged | 1 | #87 | usage analytics; see `docs/runlog/phase3-09.md` |
| phase3-07-mcp-plugins | merged | 1 | #88 | plugin lifecycle; see `docs/runlog/phase3-07.md` |
| phase3-14-ui-navigation | merged | 1 | #89 | navigation foundation; see `docs/runlog/phase3-14.md` |
| phase3-16-keyboard-notifications | merged | 1 | #90 | shortcuts and notifications; see `docs/runlog/phase3-16.md` |
| phase3-15-ui-viewers | merged | 1 | #91 | viewer/explore web foundation; see `docs/runlog/phase3-15.md` |
| phase3-01-thread-media | merged | 1 | #92 | thread media/annotations; see `docs/runlog/phase3-01.md` |
| phase3-02-watches-captain-sharing | merged | 1 | #93 | watches/captain sharing; see `docs/runlog/phase3-02.md` |
| phase3/4-closeout | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/94 | terminalizes remaining rows with explicit blocked causes; see `docs/runlog/P3-EXIT.md` and `docs/runlog/P4-EXIT.md` |
| planU | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/95 | unblock plan: 52 handoffs, `BLOCKED-TRIAGE.md` |
| unblock-01-readme-quickstart | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/96 | README quickstart run on the VM, `.env.example` (names only); see `docs/runlog/unblock-01.md` |
| unblock-02-web-composer-queue | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/97 | composer queue, versions, context meter; see `docs/runlog/unblock-02.md` |

## Next action

1. unblock-03-web-composer-cards
2. unblock-04-web-settings-models
3. unblock-05-web-captain-automations

Do not merge `flotilla/p1` into `main`.

## Phase 1 summary (preserved)

Phase 1 units 01-17 are integrated on `flotilla/p1`. Proven: `make check`, compose health `ok`, first-run admin setup/login, a fake Docker-backed thread completing with events/cost, and a low-budget fake thread pausing with an approval. Not proven live: vendor CLIs/logins, real GitHub PR/webhook/autofix, end-to-end egress/preview/Captain relay, scheduler restart recovery. Detailed evidence: `docs/runlog/P1-EXIT.md`.

## Blocked units

None as whole units. Row-level blocked items are recorded in `docs/plan/PARITY.md` and unit runlogs.

## Unverified items

- phase2-36: machine cost uses runner type `pool` until phase2-12 machine core stamps sizes; no browser e2e for `/usage`; real vendor run-out detection (CAPY-333) still needs human login. See `docs/runlog/phase2-36.md`.

See `docs/runlog/P1-EXIT.md` and phase-2 runlogs (phase2-33: `docs/runlog/phase2-33.md`). Live vendor, GitHub, device, paired-machine and vendor-login behavior remains `needs-human-login` or unverified where marked.


## Final summary

Rows by status: done 394; blocked 199; needs-human-login 24; n-a 22; pending 0. P2: 255 done, 82 blocked, 16 needs-human-login. P3: 97 done, 95 blocked. P4: 22 blocked.

Blocked causes are grouped in `docs/runlog/P3-EXIT.md` and `docs/runlog/P4-EXIT.md`; exact row-level causes are in `docs/plan/PARITY.md`. The large groups are external Slack/Linear/vendor connectors, cloud phones/OIDC/SSO, desktop/mobile runtimes, organization administration, advanced issue/PR UI, and deeper model/machine integrations.

Live checks for a human with vendor logins: configure each vendor connector or provider named in a `needs-human-login` row, run its row-specific command from the corresponding unit runlog, then perform one end-to-end thread/action in the web UI. No live vendor behavior is claimed by this run.

Safety audit: no secrets were committed; `.env.example` contains names only; no AGPL/GPL/SSPL dependency was added; `main` was never pushed or merged; after the phase-2 rules took effect, `flotilla/p1` moved only through squash-merged PRs.

`flotilla/p1` is **not** ready to open against `main` as a complete Capy-parity implementation because 199 rows are blocked. It is ready for human review as a large foundational implementation with an explicit, complete parity ledger.
