# Flotilla parity ledger

Status values: `done`, `blocked`, `needs-human-login`, `n-a`, `pending`. Initialized from SPEC Appendix A; update in every unit PR.

| ID | area | phase | status | unit | PR link | note |
|---|---|---|---|---|---|---|
| CAPY-001 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-002 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-003 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-004 | Threads | P2 | done | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Steer goes to the live adapter via `steer()` when `steerMidTurn`; otherwise it waits in the durable `thread_inbox` for the turn end (runner-queue.test.ts). |
| CAPY-005 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-006 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-007 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | Composer send key is `Enter` or `⌘/Ctrl+Enter`, saved per browser in localStorage; the other Enter inserts a newline (thread-composer.test.ts unit + thread-composer.spec.ts browser). |
| CAPY-008 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-009 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: PATCH/DELETE `/threads/:id/inbox/:item` edit or discard a pending message; 409 once the agent read it. Blocked: web UI (edit/discard control on queued messages) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-010 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: POST `/threads/:id/inbox/:item/versions` adds version n+1 (same root) and continues from it in a new session (no adapter rewind yet). Blocked: web UI (sent-message edit and version switcher) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-011 | Threads | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-012 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | Composer uploads files through `POST /files` + `PUT /uploads/:id` and sends the file ids with the message to `POST /threads/:id/inbox` (thread-composer.spec.ts); phase2-05 copies them to `/run/flotilla/attachments` on the agent machine (runner-queue.test.ts). |
| CAPY-013 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-014 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-015 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | `GET /threads/:id/requests` titles cards by what is needed (merge PR, set ENV, use desktop, approve feedback); env cards save inline via `/me/environment-variables`, desktop opens in an iframe, Dismiss shows Undo (`POST /approvals/:id/undo`) (thread-composer.test.ts + spec). |
| CAPY-016 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | `GET /thread-lookup?q=` resolves thread codes/titles among threads the viewer may see; Cmd/Ctrl+K palette jumps to a thread and `@` in the composer inserts the code. Codes stay `FLO-XXXX` (see DECISIONS-LOG). |
| CAPY-017 | Threads | P2 | done | phase2-07 |  | Rename/regenerate/heuristic <=50-char titles; org+personal instructions reach TitleGenerator; regenerateWhen setting. Model-backed generator unverified. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-018 | Threads | P2 | done | phase2-07 |  | Archive keeps events; unarchive/Undo starts no run; a message unarchives and runs. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-019 | Threads | P2 | done | phase2-07 |  | Bulk archive/tag/file/pin/delete with per-thread results; shift-click range in web. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-020 | Threads | P2 | done | phase2-07 |  | Hard delete (cascade + thread secrets); private = owner-only. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-021 | Threads | P2 | done | phase2-07 |  | Per-viewer read/unread and @mention badge count. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-022 | Threads | P2 | done | phase2-07 |  | Join/leave/subscribe/unsubscribe on shared threads. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-023 | Threads | P2 | done | phase2-07 |  | Takeover makes the actor owner; prior owner stays a member. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-024 | Threads | P2 | done | phase2-07 |  | Transfer via share-dialog actions; connectionId reset, personal secrets never move. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-025 | Threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-026 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: GET/PATCH `/threads/:id/context`: used tokens from the last run; Compact at is editable only when the adapter declares `compaction`. Blocked: web UI (context meter and Compact-at control) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-027 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | Agent replies split into heading sections with a Reply button that quotes the section into the composer; tool calls and other work between messages fold into one `Worked · N tool calls` line (unit + browser). |
| CAPY-028 | Threads | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-029 | Threads | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-030 | Threads | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-031 | Threads | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-032 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | Composer `No project` creates a thread with `projectId: null` (browser); the fake adapter runs it in `/workspace` with no repo or branch (thread-composer.test.ts). This Mac pairing belongs to the host adapter units. |
| CAPY-033 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | Left-edge ticks, one per human message, scroll to that message (thread-composer.spec.ts). |
| CAPY-034 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | Reading place (`thread_reading_places`, migration 0013) is saved per viewer on scroll and restored on open, and it does not move when a turn closes (thread-composer.test.ts + spec). |
| CAPY-035 | Wakes & background | P1 | done | phase1fix-01 | https://github.com/flotilla-ai/flotilla/pull/20 | Restart-safe wake persistence/coalescing proved by real Postgres fake-clock test. |
| CAPY-036 | Wakes & background | P1 | done | phase1fix-01 | https://github.com/flotilla-ai/flotilla/pull/20 | Restart-safe wake persistence/coalescing proved by real Postgres fake-clock test. |
| CAPY-037 | Wakes & background | P1 | done | phase1fix-01 | https://github.com/flotilla-ai/flotilla/pull/20 | Restart-safe wake persistence/coalescing proved by real Postgres fake-clock test. |
| CAPY-038 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | `WakeRouter.github` wakes on human `pull_request_review`/`*_comment` webhooks; `[bot]`/`type: Bot` and the org/personal `bots` list are ignored unless in `allowBots`. Test `apps/server/src/wakes/wakes.test.ts`. Live GitHub App event subscription unverified. |
| CAPY-039 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | Merge/conflict wakes only if a human `user.message` landed within `mergeWindowDays` (default 3, org/personal). Test `wakes.test.ts`. |
| CAPY-040 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | LISTEN on `flotilla_events`: a child (`parent_id`) run completing or opening an approval delivers "Subagent … finished/blocked" to the parent. Cross-thread messages: CAPY-049. Test `wakes.test.ts`. |
| CAPY-041 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | `wake_watches` timers (1 s–7 days) fired by the module sweep (15 s); a thread at its $ cap or with an open budget approval keeps the timer active and never starts a run. Test `wakes.test.ts`. |
| CAPY-042 | Wakes & background | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-043 | Wakes & background | P2 | blocked | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | Server proven: `wake_settings` org + personal (field-by-field), React/Keep as context/Ignore per event, `GET/PUT /wake-settings/{org,me}` (org admin-only), context items prefix the next react. Blocked: no web settings screen in budget. |
| CAPY-044 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | `GET /threads/:id/waiting` and the Activity page show the awaited event as a link, e.g. "Waiting on api#212 checks" → PR checks. Server + web tests. Thread-header placement not built (main.tsx out of scope). |
| CAPY-045 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | Activity page (`/watches`) lists active watches with Stop watching (`DELETE /watches/:id`, owner-only; stops running jobs). Server + web tests. |
| CAPY-046 | Wakes & background | P2 | blocked | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | Router proven with a fake executor: default 30 min, max 6 h timeout, $ cap, wake on exit/timeout, `keepAwake` flag. Blocked: no machine idle-stop consumes `keepAwake` yet (phase2-12), and production has no machine executor yet (jobs return Conflict). |
| CAPY-047 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | Existing runner `/plan` gate writes the plan and opens a blocking approval with no vendor plan mode; timer wakes do not bypass it. Test `wakes.test.ts`. |
| CAPY-048 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | `GET /threads/:id/peek?q=&save=1` returns status/PRs/history, filters, saves markdown to `api_files`; creates no event, inbox item or run. Test `wakes.test.ts`. |
| CAPY-049 | Wakes & background | P2 | done | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | `POST /threads/:id/send` delivers as a steer and adds a `thread` watch; the target's next completed run wakes the sender once. Test `wakes.test.ts`. |
| CAPY-050 | Wakes & background | P2 | blocked | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | Hold/allow proven: `PUT /threads/:id/hold`, held items in `wake_inbox`, owner-only allow/decline. Blocked: BYOM threads do not auto-enable hold and there is no held-messages UI (BYOM is a later unit). |
| CAPY-051 | Wakes & background | P2 | blocked | phase2-17 | https://github.com/flotilla-ai/flotilla/pull/45 | Only `rsyncArgv` (rsync over ssh, BatchMode) through the background-job path is tested with a fake executor. Blocked: needs a BYOM machine with SSH (later unit). |
| CAPY-052 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | Child thread (`parent_id`) + `subagents` row; addressed `Subagent 1.3`, depth limit 3 in `SubagentStore.create` (403 beyond). Own conversation/run. Flotilla-delegate path; adapter-native `subagent` events are not mapped. |
| CAPY-053 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | Draft = thread `idle` with no inbox item; PATCH title/prompt until `POST /subagents/:id/start` (409 after). |
| CAPY-054 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | Start queues only the draft prompt; fresh session (`resumeSessionId: null`); no parent events copied. |
| CAPY-055 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | `placement` required: `shared` mounts the nearest non-shared ancestor workspace read-only (no seed), `fresh` gets its own container/volume/branch. |
| CAPY-056 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | `parallel` fresh siblings must claim disjoint `paths` (409); `stacked` uses the previous sibling branch as base (409 until it exists). |
| CAPY-057 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | States map from thread status: draft/working/waiting (budget or run-out pause)/idle (stopped)/done/failed. |
| CAPY-058 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | After-run hook queues `Subagent N "title" finished. Summary:` or `... is blocked and asks: <question>` on the parent inbox; `GET /subagents/:id/progress` reads state, tool calls and text (prose is buffered by the kernel scrubber until the run ends). |
| CAPY-059 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | `GET /subagents/:id/diff` (mirror `base...branch`, applies with `git apply`), `POST /subagents/:id/pr` (head = child branch), `POST /subagents/:id/feedback`. Applying the patch inside the parent workspace is left to the parent agent. |
| CAPY-060 | Subagents & forks | P2 | done | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | Per-subagent engine resolved through the model catalog (`resolveEngine`); granted budget = min(request, parent cap − spent − sibling grants), 403 when nothing is left. |
| CAPY-061 | Subagents & forks | P2 | blocked | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | No paired-device machine driver on `flotilla/p1`; needs the BYOM/device-pairing unit to add a placement target. |
| CAPY-062 | Subagents & forks | P2 | blocked | phase2-18 | https://github.com/flotilla-ai/flotilla/pull/44 | Siblings are created and messaged through the user-authenticated subagent API; no agent-callable tool for non-Captain threads exists (Captain `crew.*` MCP tools are outside this unit). |
| CAPY-063 | Subagents & forks | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-064 | Subagents & forks | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-065 | Subagents & forks | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-066 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-067 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-068 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-069 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-070 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-071 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-072 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-073 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-074 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-075 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-076 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-077 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-078 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-079 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Restart-safe wake persistence/coalescing proved by real Postgres fake-clock test. |
| CAPY-080 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-081 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-082 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-083 | Captains | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-084 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-085 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-086 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Restart-safe wake persistence/coalescing proved by real Postgres fake-clock test. |
| CAPY-087 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-088 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-089 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-090 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-091 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-092 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-093 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-094 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-095 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-096 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-097 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-098 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-099 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-100 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-101 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-102 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-103 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-104 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-105 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-106 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-107 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-108 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate with a real GitHub PAT: create a test project/thread, let it push and open a PR. |
| CAPY-109 | Pull requests & autofix | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-110 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-111 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-112 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-113 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-114 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-115 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-116 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-117 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-118 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate with live GitHub CI: failing and passing checks wake the owning thread. |
| CAPY-119 | Pull requests & autofix | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-120 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-121 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-122 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-123 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-124 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-125 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-126 | Pull requests & autofix | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-127 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-128 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | measure live CI pickup latency with a real GitHub check suite. |
| CAPY-129 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate Actions log reading and rerun permissions with a real GitHub token. |
| CAPY-130 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-131 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-132 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-133 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-134 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-135 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-136 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-137 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-138 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-139 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-140 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-141 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-142 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-143 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-144 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-145 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-146 | Review | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-147 | Review | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-148 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-149 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-150 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-151 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-152 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-153 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-154 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-155 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-156 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-157 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-158 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-159 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-160 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-161 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-162 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-163 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-164 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-165 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-166 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-167 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-168 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-169 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-170 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-171 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-172 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-173 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-174 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-175 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-176 | Projects | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-177 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | `source:{kind:"empty"}` creates a project with `repo:null, repos:[]`; its threads still get project codes; `ensureMirror` refuses with `scope: project has no repository`. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-178 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | `repos[]` with `role` primary|lazy; the primary is mirrored at creation (mirror id = project id, seeded by the runner); lazy repos are mirrored only on `POST /projects/:id/repos/:repoId/clone`. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-179 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | `describeRepo` builds one sentence from package.json/Cargo.toml/pyproject.toml description, else the first README prose sentence (<=160 chars); stored on the repo when mirrored. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-180 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | `name`, emoji `icon`, unique uppercase `code` (2-6, derived from name if absent); a `threads` BEFORE INSERT trigger numbers project threads `CODE-n`. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-181 | Projects | P2 | needs-human-login | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | Sources `github|git-url|folder|empty` (+ `lazy[]`) and `GET /projects/suggestions` proven with local git fixtures and a fixture GitHub list. When `GITHUB_TOKEN` is set, only admins can list suggestions or add/clone GitHub repos (403 for members, suggestions `[]`). Blocked remainder: members adding GitHub repos with their own access needs per-user GitHub identity (P3). Live `GET /user/repos?sort=pushed`, live clones and device-folder clones (phase2-15) are unproven; operator commands are in `docs/runlog/phase2-29.md`. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-182 | Projects | P2 | blocked | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | Proven: `visibility` is `private` by default, and private projects are hidden (404) from other users and only the owner edits or clones. Blocked: the non-private counterpart is not usable by teammates. `shared` projects are listed and readable, but `ThreadRunner.create` and Captain creation still require `projects.owner_id`, so collaborator use needs P3 org membership. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-183 | Environment & snapshots | P2 | blocked | phase2-10 |  | Versioned per-project `EnvironmentSpec` (setup phases, startup entries, commands) with shared history: `environments.test.ts`, UI `apps/web/e2e/environments.spec.ts`. Blocked remainder: container snapshot (phase2-11); phase2-12 must call `registerEnvironmentMachine` and `EnvironmentStore.prepare` at machine boot. |
| CAPY-184 | Environment & snapshots | P2 | blocked | phase2-10 |  | `environment.verify` runs initialize on the thread machine and records the verdict on the version (local-process machine fixture). Blocked: phase2-12 must call `registerEnvironmentMachine` and `EnvironmentStore.prepare` at machine boot; no "Ask to set up" button. |
| CAPY-185 | Environment & snapshots | P2 | blocked | phase2-10 |  | initialize 900 s / refresh 300 s defaults, 60-3600 s validation, timeout kill, fresh-clone vs moved-checkout `choosePhase`, proven with a local-process machine. Blocked: phase2-12 must call `registerEnvironmentMachine` and `EnvironmentStore.prepare` at machine boot. |
| CAPY-186 | Environment & snapshots | P2 | blocked | phase2-10 |  | Named startup entries wait for their readiness port, flag preview, `wake()` reruns them, `stop()` reports stopped. Blocked: phase2-12 must call `registerEnvironmentMachine` and `EnvironmentStore.prepare` at machine boot and `EnvironmentExecutor.wake` on machine wake. |
| CAPY-187 | Environment & snapshots | P2 | blocked | phase2-10 |  | `bash -c` from `caps.repoDir` with thread env and `FLOTILLA_SUDO` from machine caps (off by default, so BYOM gets no sudo). Blocked: phase2-12 must call `registerEnvironmentMachine` and `EnvironmentStore.prepare` at machine boot; running as the sudo user is machine-image work (phase2-12). |
| CAPY-188 | Environment & snapshots | P2 | blocked | phase2-10 |  | `POST /threads/:id/environment/commands/:name` runs a named command on the registered machine and records state. Blocked: phase2-12 must call `registerEnvironmentMachine` and `EnvironmentStore.prepare` at machine boot. |
| CAPY-189 | Environment & snapshots | P2 | done | phase2-10 |  | + menu lists services (port, preview), commands (runnable) and terminals with status dots; failed is orange. API `GET /threads/:id/environment`, UI e2e `apps/web/e2e/environments.spec.ts` (mocked API). Terminal entries stay empty until a terminal unit reports them. |
| CAPY-190 | Environment & snapshots | P2 | blocked | phase2-10 |  | `environment.read`/`environment.replace` (whole spec, validated, stale `baseVersion` refused, own project only) via `POST /threads/:id/environment/tools/:name`. Blocked: not yet in the Captain/agent tool registry; verify needs phase2-12 must call `registerEnvironmentMachine` and `EnvironmentStore.prepare` at machine boot. |
| CAPY-191 | Environment & snapshots | P2 | done | phase2-10 |  | A completed run whose repo has `.flotilla/setup.json` (preferred) or `.capy/setup.json` becomes a new `repo-file` version (`onAfterRun` + `copyOut`); `POST /projects/:id/environment/import` too. Capy field names are inferred. |
| CAPY-192 | Environment & snapshots | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-193 | Environment & snapshots | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-194 | Environment & snapshots | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-195 | Environment & snapshots | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-196 | Environment & snapshots | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-197 | Environment & snapshots | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-198 | Cloud machines | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-199 | Cloud machines | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-200 | Cloud machines | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-201 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-202 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-203 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-204 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-205 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-206 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-207 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-208 | Cloud machines | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-209 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-210 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-211 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-212 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-213 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-214 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-215 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-216 | Cloud machines | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-217 | Cloud machines | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-218 | Cloud machines | P2 | done | phase2-09 | PR pending | Pool containers set MemorySwap=Memory and OomKillDisable=false (mocked-docker test); live docker run with the same flags: allocator OOM-killed (137), container and `sleep` survive (runlog). |
| CAPY-219 | Cloud machines | P2 | done | phase2-09 | PR pending | DockerMachineDriver.platforms is linux only; macOS/iOS start requests are refused with a paired-device (BYOM) pointer. Device execution itself is phase2-14/15. |
| CAPY-220 | Previews | P1 | done | phase1fix-03 | https://github.com/flotilla-ai/flotilla/pull/22 | Local fixture network proves authenticated preview cookie/share access, no-token and UI-cookie rejection, and gate bearer enforcement. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-221 | Previews | P2 | done | phase2-09 | PR pending | GET /threads/:id/previews suggests listening ports read from /proc/net/tcp, hides reserved Flotilla ports and refuses to expose them; web `#/previews` panel lists suggestions with Open buttons, shows reserved ports and renders the preview in an in-app iframe via the one-time token (API fixture test + web render test). |
| CAPY-222 | Previews | P1 | done | phase1fix-03 | https://github.com/flotilla-ai/flotilla/pull/22 | Local fixture network proves authenticated preview cookie/share access, no-token and UI-cookie rejection, and gate bearer enforcement. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-223 | Previews | P2 | done | phase2-09 | PR pending | Each proxied request moves previews.awake_until to now+5 min capped at 4 h from the window start; asleep machine returns a 503 card with a Start the machine link to the UI. Machine sleep enforcement is phase2-12. |
| CAPY-224 | Previews | P2 | done | phase2-09 | PR pending | Preview URL is derived from thread code + port only and survives sleep; when nothing listens the stored start command reruns in the machine (debounced 30 s) behind a 503 auto-refresh card. |
| CAPY-225 | Previews | P2 | done | phase2-09 | PR pending | Per-preview hostname (e.g. `web.localhost:1355`) is sent as the upstream Host header so portless-style routers resolve the app; localUrl uses it too. |
| CAPY-226 | Previews | P2 | done | phase2-09 | PR pending | Previews work on threads with no PR; each preview carries an in-machine localUrl for the machine browser alongside the private preview URL. |
| CAPY-227 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-228 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-229 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-230 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-231 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-232 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-233 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-234 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-235 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-236 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-237 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-238 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-239 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-240 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-241 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-242 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-243 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-244 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-245 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-246 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-247 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-248 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-249 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-250 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-251 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-252 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-253 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-254 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-255 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-256 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-257 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-258 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-259 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-260 | Dock CLI | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-261 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-262 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-263 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-264 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-265 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-266 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-267 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-268 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-269 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-270 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-271 | Cloud phones | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-272 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | Scopes `org`, `user`, `project`, `project-user`, `automation`, `captain` in `drive_items` (Postgres) + content-addressed blobs in `FLOTILLA_DRIVE_DIR`; access: org read all/write admin, personal owner, project owner, automation admin, Captain owner (drive-core.test.ts). |
| CAPY-273 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | Each thread mount copies its Drives to `/run/flotilla/drive/<scope>` before the agent starts (`onBeforeRun`); root `AGENTS.md` text is appended to the prompt (drive-core.test.ts, fake driver + fake adapter). |
| CAPY-274 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | `skills/<name>/SKILL.md` files are mounted and listed by name/path in the run prompt and `GET /threads/:id/drive` (drive-core.test.ts). |
| CAPY-275 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | After a run, changed files in writable mounted Drives are saved as new versions `by` the thread (`source=agent`), no git commit; unchanged files skipped; deletions inside the machine are not synced (drive-core.test.ts). |
| CAPY-276 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | `/#/drive` page (scope picker, folders, edit+Save with `baseVersion`, upload, delete); `PUT /drive/files` rejects >32 MB uploads with a card (drive-core.test.ts + e2e/drive-core.spec.ts with mocked API). |
| CAPY-277 | Drive | P2 | blocked | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | `GET /threads/:id/drive/copy` returns a point-in-time tar (`x-flotilla-drive-sync: none`) and later edits are not reflected (drive-core.test.ts); nothing unpacks it into `~/.flotilla/drive` on a local machine yet; needs the BYOM machine unit. |
| CAPY-278 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | Every version kept in `drive_versions` (no expiry); `GET /drive/items/:id/versions`, `POST /drive/items/:id/restore` writes a new `restore` version (drive-core.test.ts). |
| CAPY-279 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | No plans in Flotilla: quota per Drive is `FLOTILLA_DRIVE_QUOTA_BYTES` (default 10 GiB); 100 MiB per file; quota counts every retained version; an over-quota save returns 413 with a `drive_full` card shown on the Drive page (drive-core.test.ts + spec). |
| CAPY-280 | Drive | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-281 | Drive | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-282 | Drive | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-283 | Drive | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-284 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-285 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-286 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-287 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-288 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-289 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-290 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-291 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-292 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-293 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-294 | Instructions & rules | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-295 | Skills | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-296 | Skills | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-297 | Skills | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-298 | Skills | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-299 | Skills | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-300 | Skills | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-301 | Skills | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-302 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-303 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-304 | MCP & plugins | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-305 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-306 | MCP & plugins | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-307 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-308 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-309 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-310 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-311 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-312 | MCP & plugins | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-313 | MCP & plugins | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-314 | MCP & plugins | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-315 | MCP & plugins | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-316 | MCP & plugins | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-317 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-318 | Models & connections | P2 | needs-human-login | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | catalog rows (adapter+model, list price, BYOK, ZDR) proven with built-in free + operator fixture file; real vendor rows/prices: operator fills FLOTILLA_MODEL_CATALOG. |
| CAPY-319 | Models & connections | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate the real default vendor model list/configuration with vendor login. |
| CAPY-320 | Models & connections | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-321 | Models & connections | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate Claude/Codex subscription login behavior on mehdi's machine. |
| CAPY-322 | Models & connections | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate Claude Agent SDK harness behavior with a real Claude login. |
| CAPY-323 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-324 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-325 | Models & connections | P2 | needs-human-login | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | none…max validated per catalog model, unsupported fails with no fallback, effort reaches StartInput (fake); CLI effort-flag mapping unverified with real claude/codex. |
| CAPY-326 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-327 | Models & connections | P2 | done | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | owner → org → free order, reorder, per-connection models, edit/test/reconnect/disable (fixture endpoint). |
| CAPY-328 | Models & connections | P2 | needs-human-login | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | provider list from adapter auth capabilities, searchable; subscription = CLI vendor/device login; real logins and gateway list need mehdi. |
| CAPY-329 | Models & connections | P2 | needs-human-login | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | check access via local OpenAI-compatible fixture; exclusions; new models auto-covered; real provider endpoints need a key. |
| CAPY-330 | Models & connections | P2 | needs-human-login | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | custom model ids added/found/selectable on a connection (fixture); real key needed for live endpoint. |
| CAPY-331 | Models & connections | P2 | done | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | pinned connection never falls back; its key alone reaches the run env (fake). |
| CAPY-332 | Models & connections | P2 | blocked | phase2-03 | https://github.com/flotilla-ai/flotilla/pull/30 | blocked: the row is the web model picker (badges, connection tooltip, Alt+1…9 favorites) and `apps/web` is outside phase2-03 SCOPE; the server API returning badges, tooltips, favorites and shortcuts is proven (models-catalog.test.ts). Needs a web picker unit. |
| CAPY-333 | Models & connections | P2 | needs-human-login | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | Proven offline (model-policy-api.test.ts, web model-policy-api.test.tsx): per-user `runOut` ask (default, pause-and-ask) / ask-before-free / keep-going; a `run_out` run opens a Wait/Use <next connection> card, `/wait` and `/continue` typed into the thread answer it, Use reruns the prompt on the next connection. Live: the Claude Code/Codex adapters do not yet map a vendor usage-limit exit to `run_out`; operator check: `claude auth login` then run a thread until the subscription limit, and `codex login` likewise, and record the CLI's final event. |
| CAPY-334 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-335 | Models & connections | P2 | done | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | Policy `neverFree` and `excludedAdapters` drop the free models / a company's adapter from `GET /api/v1/models`, the picker, resolve (pinned or not) and run-out next-connection; web policy form sets both (model-policy-api.test.ts, model-policy-api.test.tsx). |
| CAPY-336 | Models & connections | P2 | done | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | `GET /api/v1/models` returns one row per adapter:model with display name, context window, efforts, free/ZDR and the connections in run order; web Models page lists it (model-policy-api.test.ts, model-policy-api.test.tsx). |
| CAPY-337 | Models & connections | P2 | needs-human-login | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | Catalog `contextWindow` is listed, carried on the thread engine and passed to Codex as `-c model_context_window=1050000` (argv proven with a fixture GPT-6 row). Live: `codex login && codex exec --json --model gpt-6 -c model_context_window=1050000 'say ok'` with a real GPT-6 catalog row (model id/window unverified). |
| CAPY-338 | Models & connections | P2 | blocked | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | `POST /api/v1/models/background` resolves the user's policy `background` model, else the thread's own, under the same policy and connections (no hosted account) — proven. Blocked: phase2-07's `TitleGenerator` is the offline heuristic and no PR-summary generator exists; a model-backed generator that runs on this resolver's selection is still needed (owner: the unit adding model-generated titles/PR summaries). |
| CAPY-339 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-340 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-341 | Billing & plans | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-342 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-343 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-344 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-345 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-346 | Billing & plans | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-347 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-348 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-349 | Billing & plans | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-350 | Billing & plans | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-351 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-352 | Usage & analytics | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-353 | Usage & analytics | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-354 | Usage & analytics | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-355 | Usage & analytics | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-356 | Usage & analytics | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-357 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-358 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-359 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-360 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-361 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-362 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-363 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-364 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-365 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-366 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-367 | Org, members & access | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-368 | SSO & sign-in | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-369 | SSO & sign-in | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-370 | SSO & sign-in | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-371 | SSO & sign-in | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-372 | SSO & sign-in | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-373 | SSO & sign-in | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-374 | Security & data | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-375 | Security & data | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-376 | Security & data | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-377 | Security & data | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-378 | Security & data | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-379 | Security & data | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-380 | Security & data | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | AES-256-GCM envelope (per-value DEK, HKDF KEK from FLOTILLA_MASTER_KEY[_FILE], AAD scope:id:name) in Postgres `secrets` (secrets.test.ts). |
| CAPY-381 | Security & data | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-382 | Security & data | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | GET /api/v1/threads/:id/export returns thread, runs, events and env names only; no values. |
| CAPY-383 | Secrets | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | Project (shared), personal and thread scopes; precedence thread > personal > shared. |
| CAPY-384 | Secrets | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | APIs, grants, export and events show names + configured only; values scrubbed from events and never put in prompts (fake adapter spy). |
| CAPY-385 | Secrets | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | Decrypt only in SecretsStore.prepare during runner machine prep; written to /run/flotilla/secrets.env (0600, uid 1000) outside /workspace/repo. |
| CAPY-386 | Secrets | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | The thread owner's personal values apply to the thread whoever drives it (prepare resolves by owner). |
| CAPY-387 | Secrets | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | GitHub token names/values refused by the vault and filtered at prepare; mirror keeps tokens server-side. |
| CAPY-388 | Secrets | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | PUT/GET/DELETE /api/v1/projects/:id/environment-variables; values write-only. |
| CAPY-389 | Secrets | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | POST /threads accepts environmentVariables [{name,value}], validated before insert, stored thread-scoped write-only. |
| CAPY-390 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-391 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-392 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-393 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-394 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-395 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-396 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-397 | Cloud credentials (OIDC) | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-398 | GitHub | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | install/validate the GitHub app webhook and permission flow live. |
| CAPY-399 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-400 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-401 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-402 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-403 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-404 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-405 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-406 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-407 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-408 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-409 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-410 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-411 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-412 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-413 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-414 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-415 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-416 | Linear | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-417 | Linear | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-418 | Linear | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-419 | Linear | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-420 | Linear | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-421 | Linear | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-422 | Other integrations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-423 | Other integrations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-424 | Other integrations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-425 | Other integrations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-426 | Other integrations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-427 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-428 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-429 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-430 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-431 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-432 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-433 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-434 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-435 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-436 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-437 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-438 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-439 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-440 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-441 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-442 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-443 | Keyboard shortcuts | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-444 | Keyboard shortcuts | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-445 | Keyboard shortcuts | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-446 | Keyboard shortcuts | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-447 | Keyboard shortcuts | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-448 | Notifications | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-449 | Notifications | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-450 | Notifications | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-451 | Notifications | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-452 | Notifications | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-453 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | flt_ bearer keys minted only from a session; optional expiresAt; no rotate verb (api-platform.test.ts). |
| CAPY-454 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | Keys resolve to user or service principal; authorId = minting human; service-key project owned by service user. |
| CAPY-455 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | requestId/Idempotency-Key replay in requireSession; reuse on another path = flotilla/Conflict. |
| CAPY-456 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | Page<T> {items,cursor} on GET /files; bounded GET /api-keys returns {items}. |
| CAPY-457 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | ?frames=public SSE: status/run/turn/tool_call/assistant/transcript, id=seq, Last-Event-ID resume, retry 2000. |
| CAPY-458 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | flotilla/* typed errors incl. RateLimited (per-key window), PaidFeatureUnavailable, CrewRefused, BillingAuthorityUnavailable. |
| CAPY-459 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | /api/v1/tasks/* 308 to /threads with Deprecation; migration guide in apps/server/src/api-platform/API.md. |
| CAPY-460 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | Common flows doc API.md; test asserts every documented route exists. |
| CAPY-461 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | POST /api/v1/webhooks/automations/:secret -> hashed lookup, durable delivery row, 202; trigger semantics in phase2-26. |
| CAPY-462 | API (platform) | P2 | done | phase2-01 | https://github.com/flotilla-ai/flotilla/pull/25 | POST /files presigned PUT grant, single-use upload, attachFiles(fileIds) resolver; composer wiring in phase2-06. |
| CAPY-463 | Support | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-464 | Support | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-465 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: `/plan` prefixes PLAN_PROMPT, opens a blocking `gate='plan'` approval, skips after-run hooks and holds the inbox until approved. Blocked: web UI (/plan composer command and plan-approval card) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-466 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: `/btw <q>` creates a child thread (`parent_id`) and emits `thread.side` on the parent. Blocked: web UI (/btw side-thread panel) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-467 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: Messages with un-uploaded owned files wait as `waiting_upload` and are released by `resumePending()` (also after restart). Blocked: web UI (pending-upload indicator on the composer) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-468 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: GET `/threads/:id/inbox` returns `queuedCount` and `folded` (>=2). Blocked: web UI (folded queue count) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-469 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: Adapter errors are classified (`runs.error`, `run.ended.error`); POST `/threads/:id/retry` re-sends the last message, optionally with another model/connection. Blocked: web UI (retry/error card with model switch) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-470 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: POST `/approvals/:id/later` (snooze) and `/dismiss`, POST `/captains/:id/approvals/dismiss`; each emits `approval.updated`. Blocked: web UI (request cards with Later/Dismiss and Captain dismiss-all) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-471 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | `#/compose?prompt=` (or `?prompt=` in the query string) pre-fills the new-thread composer (unit + browser). |
| CAPY-472 | Threads | P2 | done | phase2-06 | https://github.com/flotilla-ai/flotilla/pull/40 | `/feedback <title>` in the composer (or `POST /threads/:id/feedback`) drafts a report as a request card; nothing is sent until the owner clicks Send report, which POSTs the edited report to the owner's `FLOTILLA_FEEDBACK_URL` tracker; Discard sends nothing (thread-composer.test.ts with a local tracker + spec). |
| CAPY-473 | Threads | P2 | done | phase2-07 |  | Idle auto-archive off by default; skips pinned/open-PR/active/needs-you. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-474 | Threads | P2 | done | phase2-07 |  | Mark all read includes archived. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-475 | Threads | P2 | done | phase2-07 |  | Cost by token kind, model and machine. Inbox UI e2e: `apps/web/e2e/thread-lifecycle.spec.ts`. |
| CAPY-476 | Threads | P2 | blocked | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | Server/API proven in runner-queue.test.ts: Nested tool calls/results keep `parentId` in live `agent.tool_*` events. Blocked: web UI (nested codemode tool-call display) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-477 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-478 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-479 | Cloud machines | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-480 | Billing & plans | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-481 | Billing & plans | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-482 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-483 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-484 | Models & connections | P2 | needs-human-login | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | Proven offline: one list row per Claude model; a connected Claude subscription is first in run order (before an API key added earlier) and resolve picks it; production `defaultRunner` now registers the claude-code and codex adapters. Live: `claude auth login`, connect the subscription, run a thread on a Claude model and confirm it runs without ANTHROPIC_API_KEY. |
| CAPY-485 | Models & connections | P2 | blocked | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | Proven offline: PATCH `/api/v1/connections/:id` `{baseUrl}` (http/https only) reaches the next run as `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` (manifest `baseUrlEnvVar`). Blocked: no web connections editor yet (same web unit as CAPY-332). Live gateway: `ANTHROPIC_BASE_URL=<gateway> claude -p ok --bare` with the operator's key, unverified. |
| CAPY-486 | Models & connections | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-487 | Usage & analytics | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-488 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-489 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-490 | Devices & desktop app | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-491 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-492 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-493 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-494 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-495 | Captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-496 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-497 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-498 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-499 | Review | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-500 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-501 | Automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-502 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | Usage is summed as bigint; a Drive at >2 GiB accepts saves up to its quota (drive-core.test.ts, sizes recorded without writing 2 GiB). |
| CAPY-503 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | Mount/save failures insert a non-blocking `approvals` card with `detail.drive={code,title,nextStep}`; the run still starts (drive-core.test.ts). |
| CAPY-504 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-505 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-506 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-507 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-508 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-509 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-510 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-511 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-512 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-513 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-514 | SSO & sign-in | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-515 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-516 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-517 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-518 | GitHub | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-519 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-520 | MCP & plugins | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-521 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-522 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-523 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-524 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-525 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-526 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-527 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-528 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-529 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-530 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-531 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-532 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-533 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-534 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-535 | API: automations | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-536 | API: projects | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-537 | API: projects | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-538 | API: projects | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | GET /api/v1/projects/:id/environment-variables lists names/configured state. |
| CAPY-539 | API: projects | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | PUT /api/v1/projects/:id/environment-variables sets values (write-only). |
| CAPY-540 | API: projects | P2 | done | phase2-02 | https://github.com/flotilla-ai/flotilla/pull/28 | DELETE /api/v1/projects/:id/environment-variables?names= deletes. |
| CAPY-541 | API: threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-542 | API: threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-543 | API: threads | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-544 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/rename {title}` (bearer) returns ThreadLifecycle; `status` frame `renamed`. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-545 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/archive`; 409 for active threads; `status` frame `archived`. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-546 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/unarchive` restores prior status; `status` frame `unarchived`. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-547 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/takeover` on shared threads (404 private); `status` frame `takeover` from/to. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-548 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/regenerate-title` returns auto title <=50 chars; `status` frame `title-regenerated`. Model-backed generator unverified (offline heuristic). Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-549 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/read` returns ThreadReadState; per viewer, not streamed. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-550 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/unread` returns ThreadReadState (markedUnread); per viewer, not streamed. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-551 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/join` returns membership; `status` frame `joined`. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-552 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/leave` returns membership (204 for private); owner 409; `status` frame `left`. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-553 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/subscribe` returns membership; per viewer, not streamed. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-554 | API: threads | P2 | done | phase2-08 | https://github.com/flotilla-ai/flotilla/pull/37 | `POST /api/v1/threads/:id/unsubscribe` returns membership; per viewer, not streamed. Test: `apps/server/src/thread-api/thread-api.test.ts`. |
| CAPY-555 | API: captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-556 | API: captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-557 | API: captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-558 | API: captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-559 | API: captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-560 | API: captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-561 | API: captains | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-562 | API: folders | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-563 | API: folders | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-564 | API: folders | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-565 | API: folders | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-566 | API: folders | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-567 | API: folders | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-568 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-569 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-570 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-571 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-572 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-573 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-574 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-575 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-576 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-577 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-578 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-579 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-580 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-581 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-582 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-583 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-584 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-585 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-586 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-587 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-588 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-589 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-590 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-591 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-592 | API: issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-593 | API: subagents | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-594 | API: subagents | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-595 | API: subagents | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-596 | API: tasks | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-597 | API: tasks | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-598 | API: tasks | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-599 | API: messages | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-600 | API: messages | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-601 | API: messages | P2 | done | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | GET `/threads/:id/inbox/:item/versions` lists all versions of a message. |
| CAPY-602 | API: messages | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-603 | API: messages | P2 | done | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | DELETE `/threads/:id/inbox/:item` cancels a queued message. |
| CAPY-604 | API: messages | P2 | done | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | POST `/threads/:id/inbox/:item/send` jumps the queue and interrupts (or steers) the current turn. |
| CAPY-605 | API: files | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-606 | API: attachments | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-607 | API: attachments | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-608 | API: streams | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-609 | API: streams | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-610 | API: streams | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-611 | API: reviews | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-612 | API: reviews | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-613 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-614 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-615 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-616 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-617 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-618 | API: reviews | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-619 | API: reviews | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-620 | API: reviews | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-621 | API: reviews | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-622 | API: reviewRules | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-623 | API: reviewRules | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-624 | API: reviewRules | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-625 | API: reviewRules | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-626 | API: reviewRules | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-627 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-628 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-629 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-630 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-631 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-632 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-633 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-634 | API: reviewFilters | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-635 | API: usage | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-636 | API: usage | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-637 | API: usage | P2 | pending |  |  | Awaiting phase P2 unit. |
| CAPY-638 | API: users | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-639 | API: models | P2 | pending |  |  | Awaiting phase P2 unit. |
