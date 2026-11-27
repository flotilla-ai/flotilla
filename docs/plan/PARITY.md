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
| CAPY-063 | Subagents & forks | P2 | blocked | phase2-19 |  | Side chat requires a same-machine full workspace/session copy and tab UX; only the subagent API vertical slice fit this unit. Blocked: no machine workspace clone/session-copy primitive or thread tab UI yet. |
| CAPY-064 | Subagents & forks | P2 | blocked | phase2-19 |  | Fork/summary-fork requires adapter session copy for full forks plus fresh-machine workspace copy; summary-fork can use any adapter but still needs the fork lifecycle. Blocked: no fork API/workspace clone primitive yet. |
| CAPY-065 | Subagents & forks | P2 | blocked | phase2-19 |  | Passage fork/side-chat depends on the blocked fork/side-chat primitives plus composer passage selection UI; no such selection/fork workflow exists yet. |
| CAPY-066 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-067 | Captains | P2 | blocked | phase2-20 |  | New-Captain backend exists, but the required dialog with name/face/project/machine/model/access is not implemented in the web UI; blocked on that UI slice. |
| CAPY-068 | Captains | P2 | done | phase2-20 |  | `POST /captains/promote` promotes the same thread row to Captain, preserving history, PRs, machine id, engine/model and member references by identity; regression in `create-crew.test.ts`. |
| CAPY-069 | Captains | P2 | blocked | phase2-20 |  | Flotilla has no folder entity/folder removal workflow, so folder promotion cannot currently move folder threads into a crew. |
| CAPY-070 | Captains | P2 | blocked | phase2-20 |  | Natural-language “Make a Captain…” creation through an existing thread is not implemented; only direct Captain create/promote APIs exist. |
| CAPY-071 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-072 | Captains | P2 | blocked | phase2-20 |  | Crew archive/release API exists, but Captain archive does not yet put crew machines to sleep and delete/demote lifecycle is incomplete. |
| CAPY-073 | Captains | P2 | done | phase2-20 |  | Existing threads can be added to a crew with the owner-validated move action `POST /captains/:id/crew/:threadId`; regression in `create-crew.test.ts`. |
| CAPY-074 | Captains | P2 | done | phase2-20 |  | Crew rules enforce same owner/project, root non-Captain threads only, not itself, and one crew at a time with enumerated refusal reasons; regression in `create-crew.test.ts`. |
| CAPY-075 | Captains | P2 | done | phase2-20 |  | Finished crew threads can be archived by their Captain and any crew thread can be released with the existing delete action; regression in `create-crew.test.ts`. |
| CAPY-076 | Captains | P2 | blocked | phase2-22 |  | Crew lifecycle events exist in the scheduler, but turn-end/need wiring into this operations surface and beside-chat UI is not connected. |
| CAPY-077 | Captains | P2 | blocked | phase2-22 |  | No runner/crew event currently reports that a crew thread answered the user directly. |
| CAPY-078 | Captains | P2 | blocked | phase2-22 |  | Pull-requests page has no Captain filter control; no UI integration is implemented. |
| CAPY-079 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Restart-safe wake persistence/coalescing proved by real Postgres fake-clock test. |
| CAPY-080 | Captains | P2 | done | phase2-22 |  | Digest API and /captain-ops digest tab expose the digest file and top five Needs-you entries. |
| CAPY-081 | Captains | P2 | done | phase2-22 |  | One-line digest commands such as merge repo#123 are parsed, dispatched to the action handler, and the item is dropped. |
| CAPY-082 | Captains | P2 | done | phase2-22 |  | Digest-layout instructions are saved as durable captain rules and written to DIGEST-LAYOUT.md with confirmation. |
| CAPY-083 | Captains | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-084 | Captains | P2 | done | phase2-22 |  | Digest API falls back DIGEST.md, ONGOING.md, then NOTES.md and enforces the 64 KiB cap. |
| CAPY-085 | Captains | P2 | done | phase2-22 |  | Rule instructions are durable, appended to RULES.md, and return a confirmation. |
| CAPY-086 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Restart-safe wake persistence/coalescing proved by real Postgres fake-clock test. |
| CAPY-087 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-088 | Captains | P2 | done | phase2-20 |  | Promotion preserves `owner_id` and crew membership requires matching owner, so Captain actions run as the owner identity; regression in `create-crew.test.ts`. |
| CAPY-089 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-090 | Captains | P2 | done | phase2-20 |  | Crew admission requires exactly the same `project_id` as the Captain, including null/non-null separation; regression in `create-crew.test.ts`. |
| CAPY-091 | Captains | P2 | blocked | phase2-21 |  | Captains default to pool placement, but paired-device Captain execution is unavailable because no paired-device plane exists. |
| CAPY-092 | Captains | P2 | blocked | phase2-21 |  | Pool placement and per-thread machine-name metadata exist, but cloud-vs-device selection fails closed because paired devices are unavailable. |
| CAPY-093 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-094 | Captains | P2 | done | phase2-21 |  | Captain alias is durable profile metadata with validation. |
| CAPY-095 | Captains | P2 | blocked | phase2-22 |  | Automations still create ordinary threads and cannot yet hand work to or start Captain threads. |
| CAPY-096 | Captains | P2 | done | phase2-22 |  | Captain-to-captain messages are durable and suppressed when an active suppress-chatter rule matches. |
| CAPY-097 | Captains | P1 | done | phase1fix-02 | https://github.com/flotilla-ai/flotilla/pull/21 | Compose fake-agent relay proves five crew, kernel sixth-crew denial, one coalesced wake, digest and Needs-you propagation. | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-098 | Captains | P2 | blocked | phase2-22 |  | Captains-first/hybrid sidebar with pinned faces and waiting questions is not implemented. |
| CAPY-099 | Captains | P2 | blocked | phase2-22 |  | No chat observer starts work from a passing mention. |
| CAPY-100 | Captains | P2 | done | phase2-22 |  | Feature, Triage and Janitor captain templates are exposed by the API and web copy. |
| CAPY-101 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-102 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-103 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-104 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-105 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-106 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-107 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-108 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate with a real GitHub PAT: create a test project/thread, let it push and open a PR. |
| CAPY-109 | Pull requests & autofix | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-110 | Pull requests & autofix | P2 | done | phase2-23 |  | Branch prefix setting is durable and release/release/* is rejected. |
| CAPY-111 | Pull requests & autofix | P2 | blocked | phase2-23 |  | Org/personal draft defaults are durable, but per-PR draft changes by asking the agent are not wired. |
| CAPY-112 | Pull requests & autofix | P2 | blocked | phase2-23 |  | Open-in-Flotilla preference is durable, but PR creation does not yet write the button into descriptions. |
| CAPY-113 | Pull requests & autofix | P2 | blocked | phase2-23 |  | Pulls exist at /pulls, but exact /pull/<owner>/<repo>/<n> routing and Cmd+K lookup are outside the implemented slice. |
| CAPY-114 | Pull requests & autofix | P2 | blocked | phase2-23 |  | Pull detail exposes chat/new-thread links, but they do not yet create a thread preloaded with PR context. |
| CAPY-115 | Pull requests & autofix | P2 | needs-human-login | phase2-23 |  | Fixture gateway proves merge methods/comment/update/auto-merge and blocked reasons; live GitHub mutation still requires a connected account. |
| CAPY-116 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-117 | Pull requests & autofix | P2 | needs-human-login | phase2-23 |  | Fixture gateway receives the connected-login actor vs flotilla fallback; live posting identity needs GitHub verification. |
| CAPY-118 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate with live GitHub CI: failing and passing checks wake the owning thread. |
| CAPY-119 | Pull requests & autofix | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-120 | Pull requests & autofix | P2 | done | phase2-23 |  | Open PRs with no CI wake their owning thread once about 30 minutes after the last push. |
| CAPY-121 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-122 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-123 | Pull requests & autofix | P2 | needs-human-login | phase2-23 |  | Fixture gateway proves summary/comment/request-changes/approve actor selection; live review submission needs GitHub verification. |
| CAPY-124 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-125 | Pull requests & autofix | P2 | done | phase2-23 |  | /pulls lists installed-repository PRs and supports author:/repo:/status:/label:/since: filters. |
| CAPY-126 | Pull requests & autofix | P2 | blocked | phase2-23 |  | PR status exists in pull data but the thread sidebar has no extension point inside this unit scope. |
| CAPY-127 | Pull requests & autofix | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-128 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | measure live CI pickup latency with a real GitHub check suite. |
| CAPY-129 | Pull requests & autofix | P1 | needs-human-login | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | validate Actions log reading and rerun permissions with a real GitHub token. |
| CAPY-130 | Review | P2 | blocked | phase2-24 |  | Review runs are durable/read-only/head-pinned metadata, but no real machine checkout or review agent execution is wired yet. |
| CAPY-131 | Review | P2 | done | phase2-24 |  | Findings persist category, severity, confidence, file and line with validation. |
| CAPY-132 | Review | P2 | done | phase2-24 |  | Notes persist as anchored non-failing observations and are excluded from posting unless opted in. |
| CAPY-133 | Review | P2 | done | phase2-24 |  | Per-repo automatic mode off/once/every-push is validated and durable. |
| CAPY-134 | Review | P2 | blocked | phase2-24 |  | API and source labels exist, but PR-page buttons and @mention ingestion are not connected. |
| CAPY-135 | Review | P2 | done | phase2-24 |  | A push with a new head creates a fresh round and supersedes the prior round findings. |
| CAPY-136 | Review | P2 | done | phase2-24 |  | Low/Medium/High/Flex credit costs are exactly 1/5/10 and flex follow-ups cost 1. |
| CAPY-137 | Review | P2 | blocked | phase2-24 |  | Review runs record adapter/connection selection, but no policy yet prevents use of owner keys/subscriptions. |
| CAPY-138 | Review | P2 | done | phase2-24 |  | Posting threshold, investigate toggle and notes opt-in determine posted flags. |
| CAPY-139 | Review | P2 | done | phase2-24 |  | Duplicate findings are suppressed and resolved/irrelevant triage marks the mirrored thread resolved. |
| CAPY-140 | Review | P2 | done | phase2-24 |  | Open/resolved/irrelevant triage, high-confidence readiness blocking and dashboard override are durable. |
| CAPY-141 | Review | P2 | done | phase2-24 |  | Incremental rounds never reflag irrelevant findings and changed failed fixes return as new findings. |
| CAPY-142 | Review | P2 | done| phase2-25 |  | AGENTS.md never-use conventions are evaluated into deterministic finding candidates. |
| CAPY-143 | Review | P2 | done| phase2-25 |  | Review policy API and /review-policy page expose org rules, context files and path-scoped settings. |
| CAPY-144 | Review | P2 | done| phase2-25 |  | Ignore-path filters exclude matching files before review guide construction. |
| CAPY-145 | Review | P2 | needs-human-login| phase2-25 |  | The optional capy/review commit-status setting is durable, but live GitHub status writeback requires a real GitHub login. |
| CAPY-146 | Review | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-147 | Review | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-148 | Review | P2 | done| phase2-25 |  | Guide generation returns overview, ordered steps, before/after diagram and per-area chapters. |
| CAPY-149 | Review | P2 | done| phase2-25 |  | Guide generation skips lockfiles, generated files and deleted files, and timeout retry helper retries once. |
| CAPY-150 | Review | P2 | done| phase2-25 |  | Finding evidence stores and returns rules, memory and production telemetry lists. |
| CAPY-151 | Review | P2 | blocked| phase2-25 |  | Review machine read-only enforcement and the 4 GB default are not wired to machine provisioning. |
| CAPY-152 | Automations | P2 | done | phase2-26 |  | Stored prompt/project automation with 1-20 OR triggers; runs create normal threads through the runner. |
| CAPY-153 | Automations | P2 | blocked | phase2-26 |  | Automation API exists, but neither an Automations page nor agent-accessible full management tools are implemented. |
| CAPY-154 | Automations | P2 | done | phase2-26 |  | 5-field cron + IANA timezone validation, 5-minute floor, timezone-correct matching and coalesced catch-up scans. |
| CAPY-155 | Automations | P2 | done | phase2-26 |  | Signed GitHub webhook events map PR/comment/review/label/check/push/workflow_run fixtures into automation runs. |
| CAPY-156 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-157 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-158 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-159 | Automations | P2 | done | phase2-26 |  | Per-automation hashed webhook capability URL, optional HMAC, Idempotency-Key duplicate handling and 256 KB cap. |
| CAPY-160 | Automations | P2 | done | phase2-26 |  | Webhook batches collect events and support list, flush and cancel. |
| CAPY-161 | Automations | P2 | done | phase2-26 |  | Manual automation trigger API creates a run. |
| CAPY-162 | Automations | P2 | done | phase2-26 |  | Trigger conditions cover equality, lists, substring and regex across repository/branch/author/label/text payload fields. |
| CAPY-163 | Automations | P2 | blocked | phase2-26 |  | run_when is stored and injectable for fixture proof, but production has no configurable free fast-model gate adapter wired yet. |
| CAPY-164 | Automations | P2 | done | phase2-26 |  | Pinned models fail closed when unavailable; unpinned models may resolve to the free default. |
| CAPY-165 | Automations | P2 | done | phase2-26 |  | Thread mode supports new threads and a single standing thread. |
| CAPY-166 | Automations | P2 | done | phase2-26 |  | Runs may target an existing thread or create private threads. |
| CAPY-167 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-168 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-169 | Automations | P2 | done | phase2-27 |  | Webhook payloads are stored as data in automation runs and never concatenated into the stored prompt; prompt remains the only instruction source. |
| CAPY-170 | Automations | P2 | done | phase2-27 |  | max_runs_per_day is validated and enforced atomically before thread creation; over-cap events are durable skipped runs. |
| CAPY-171 | Automations | P2 | blocked | phase2-27 |  | Automation drive_scope metadata is durable, but Drive state is not yet mounted into automation runs. |
| CAPY-172 | Automations | P2 | blocked | phase2-27 |  | Per-automation machine_size is durable, but runner machine placement does not consume it yet. |
| CAPY-173 | Automations | P2 | done | phase2-27 |  | Pause/resume/delete/restore, manual trigger, run list/cancel and webhook rotation APIs are proven. |
| CAPY-174 | Automations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-175 | Automations | P2 | blocked | phase2-27 |  | Failed automation runs and thread references are retained, but runner output/completion is not yet written back to automation_runs.output. |
| CAPY-176 | Projects | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-177 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | Repoless projects create threads with project codes and runner starts them in `/workspace` without cloning. Test: `apps/server/src/projects/projects.test.ts`, `apps/server/src/runner/runner.test.ts`. |
| CAPY-178 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | Primary repositories mirror at creation while lazy repositories clone on demand. Test: `apps/server/src/projects/projects.test.ts`. |
| CAPY-179 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | Repository descriptions are derived from README/manifest fixtures at project creation. Test: `apps/server/src/projects/projects.test.ts`. |
| CAPY-180 | Projects | P2 | done | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | `name`, emoji `icon`, unique uppercase `code` (2-6, derived from name if absent); a `threads` BEFORE INSERT trigger numbers project threads `CODE-n`. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-181 | Projects | P2 | needs-human-login | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | Sources `github|git-url|folder|empty` (+ `lazy[]`) and `GET /projects/suggestions` proven with local git fixtures and a fixture GitHub list. When `GITHUB_TOKEN` is set, only admins can list suggestions or add/clone GitHub repos (403 for members, suggestions `[]`). Blocked remainder: members adding GitHub repos with their own access needs per-user GitHub identity (P3). Live `GET /user/repos?sort=pushed`, live clones and device-folder clones (phase2-15) are unproven; operator commands are in `docs/runlog/phase2-29.md`. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-182 | Projects | P2 | blocked | phase2-29 | https://github.com/flotilla-ai/flotilla/pull/42 | Proven: `visibility` is `private` by default, and private projects are hidden (404) from other users and only the owner edits or clones. Blocked: the non-private counterpart is not usable by teammates. `shared` projects are listed and readable, but `ThreadRunner.create` and Captain creation still require `projects.owner_id`, so collaborator use needs P3 org membership. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-183 | Environment & snapshots | P2 | blocked | phase2-10 |  | Versioned per-project `EnvironmentSpec` (setup phases, startup entries, commands) with shared history: `environments.test.ts`, UI `apps/web/e2e/environments.spec.ts`. Blocked remainder: container snapshot (phase2-11); phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). |
| CAPY-184 | Environment & snapshots | P2 | blocked | phase2-10 |  | `environment.verify` runs initialize on the thread machine and records the verdict on the version (local-process machine fixture). Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no "Ask to set up" button. |
| CAPY-185 | Environment & snapshots | P2 | blocked | phase2-10 |  | initialize 900 s / refresh 300 s defaults, 60-3600 s validation, timeout kill, fresh-clone vs moved-checkout `choosePhase`, proven with a local-process machine. Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no test asserts initialize/refresh selection on a pool-booted machine. |
| CAPY-186 | Environment & snapshots | P2 | done | phase2-10, phase2-12 |  | Named startup entries wait for their readiness port, flag preview, `wake()` reruns them, `stop()` reports stopped. phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Wake recreates the container, so startup reruns via `prepare` (same as `EnvironmentExecutor.wake`) and `stop()` runs at sleep. |
| CAPY-187 | Environment & snapshots | P2 | blocked | phase2-10 |  | `bash -c` from `caps.repoDir` with thread env and `FLOTILLA_SUDO` from machine caps (off by default, so BYOM gets no sudo). Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: running as the sudo user is machine-image work (phase2-12). |
| CAPY-188 | Environment & snapshots | P2 | blocked | phase2-10 |  | `POST /threads/:id/environment/commands/:name` runs a named command on the registered machine and records state. Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no test runs a named command on a pool-booted machine. |
| CAPY-189 | Environment & snapshots | P2 | done | phase2-10 |  | + menu lists services (port, preview), commands (runnable) and terminals with status dots; failed is orange. API `GET /threads/:id/environment`, UI e2e `apps/web/e2e/environments.spec.ts` (mocked API). Terminal entries stay empty until a terminal unit reports them. |
| CAPY-190 | Environment & snapshots | P2 | blocked | phase2-10 |  | `environment.read`/`environment.replace` (whole spec, validated, stale `baseVersion` refused, own project only) via `POST /threads/:id/environment/tools/:name`. Blocked: not yet in the Captain/agent tool registry; verify needs a registered machine, which phase2-12 machine core now provides at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). |
| CAPY-191 | Environment & snapshots | P2 | done | phase2-10 |  | A completed run whose repo has `.flotilla/setup.json` (preferred) or `.capy/setup.json` becomes a new `repo-file` version (`onAfterRun` + `copyOut`); `POST /projects/:id/environment/import` too. Capy field names are inferred. |
| CAPY-192 | Environment & snapshots | P2 | done | phase2-11 | https://github.com/flotilla-ai/flotilla/pull/50 | Capture + hourly check run on completed runs (`onAfterRun`); runner boot uses `SnapshotStore.bootPlan` for project threads: `snapshots.test.ts` CAPY-192, `runner.test.ts` CAPY-192/197. |
| CAPY-193 | Environment & snapshots | P2 | done | phase2-11 | https://github.com/flotilla-ai/flotilla/pull/50 | `snapshots.test.ts` CAPY-193; `e2e/snapshots.spec.ts`; Repo choice limited to project repos; disk-budget check fails the build at `repos`. |
| CAPY-194 | Environment & snapshots | P2 | done | phase2-11 | https://github.com/flotilla-ai/flotilla/pull/50 | `snapshots.test.ts` CAPY-194; `e2e/snapshots.spec.ts`; 64/128/256 GB tags; alsoSmaller tags every smaller tier that fits. Tier is a budget check, not a Docker disk quota. |
| CAPY-195 | Environment & snapshots | P2 | done | phase2-11 | https://github.com/flotilla-ai/flotilla/pull/50 | `snapshots.test.ts` CAPY-195; Secrets file, bundles, history, git credentials and secret env removed; grep verify refuses capture on a leak. |
| CAPY-196 | Environment & snapshots | P2 | done | phase2-11 | https://github.com/flotilla-ai/flotilla/pull/50 | `snapshots.test.ts` CAPY-196; `e2e/snapshots.spec.ts`; Build history with per-step logs; "Ask why it failed" prompt. |
| CAPY-197 | Environment & snapshots | P2 | done | phase2-11 | https://github.com/flotilla-ai/flotilla/pull/50 | `bootPlan` falls back to the last good/base image and the runner prepends the repair prompt instead of blocking boot: `snapshots.test.ts` CAPY-197, `runner.test.ts` CAPY-192/197. |
| CAPY-198 | Cloud machines | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-199 | Cloud machines | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-200 | Cloud machines | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-201 | Cloud machines | P2 | done | phase2-12 |  | Sizes small/medium/large/big-guy (2/4/8/16 GB, 1/2/4/8 CPU) set the pool container RAM/CPU and the awake $/h charged into `threads.spent` and `cost_entries` (`machine-estimate`); sizes above `FLOTILLA_MACHINE_MAX_SIZE` (default large) are refused with `PaidFeatureUnavailable`: `machine-core.test.ts`, web `machine-core.test.tsx`. |
| CAPY-202 | Cloud machines | P2 | done | phase2-12 |  | Project `machine_size` via `PUT /projects/:id/machine`, the agent tool `machine.set_size`, and the `/machine` size picker; the next boot uses the new size: `machine-core.test.ts`. |
| CAPY-203 | Cloud machines | P2 | done | phase2-12 |  | Charged only from wake to sleep, sleep = last release + 120 s wind-down (420 s for 5 min of work), nothing while sleeping: `machine-core.test.ts`. |
| CAPY-204 | Cloud machines | P2 | done | phase2-12 |  | Concurrent RAM of starting/awake leases is capped by `FLOTILLA_MACHINE_RAM_MB` under a Postgres advisory lock; a start waits 60 s then fails "Cloud machine couldn't start" (run fails, `machine.state` event): `machine-core.test.ts`. |
| CAPY-205 | Cloud machines | P2 | done | phase2-12 |  | Threads owned by a `service` user may use at most half of the RAM limit together: `machine-core.test.ts`. |
| CAPY-206 | Cloud machines | P2 | blocked | phase2-12 |  | Thread image has Node 22, Python 3, git and the pinned claude/codex CLIs only. Blocked: Go/Rust/Java/Ruby, Docker, Kubernetes tools, DB clients and GitHub CLI are not installed (large image work; no Docker-in-container under `--cap-drop ALL`). |
| CAPY-207 | Cloud machines | P2 | blocked | phase2-12 |  | `nodeVersionFrom` picks `.node-version` then `.nvmrc` (numeric only) and boot exports it as `FLOTILLA_NODE_VERSION` to setup/startup scripts: `machine-core.test.ts`. Blocked: the image has only Node 22 and no version manager, so nothing switches the binary. |
| CAPY-208 | Cloud machines | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-209 | Cloud machines | P2 | done | phase2-12 |  | `KERNEL_LIMITS` (no /dev/kvm, no kernel modules, not privileged, no nested containers, netfilter gaps from dropped CAP_NET_ADMIN/CAP_NET_RAW) served by `GET /machines/limits` and shown on `/machine`; matches `dockerDriver` hardening checked by `machines.test.ts`. |
| CAPY-210 | Cloud machines | P2 | done | phase2-12 |  | After the wind-down the container is removed and the `flt-workspace-<thread>` volume kept; startup processes are stopped (`EnvironmentExecutor.stop`) and every startup entry reruns through `EnvironmentStore.prepare` on wake: `machine-core.test.ts` (local-process machine). |
| CAPY-211 | Cloud machines | P2 | done | phase2-12 |  | `POST /threads/:id/machine/wake` + Wake machine button on `/machine`; agent wake when a new message runs on a sleeping machine, and the `machine.wake` tool: `machine-core.test.ts`, web `machine-core.test.tsx`. |
| CAPY-212 | Cloud machines | P2 | blocked | phase2-12 |  | Warns a day ahead (`machine.state` event). Deletion now fails closed: without a successful pre-delete WIP-capture hook the lease remains sleeping and the workspace volume is retained; a failed wake restores the prior lease without deleting the workspace: `machine-core.test.ts`. Blocked: production `beforeDelete` does not push WIP, so real 14-day workspace deletion/rebuild is intentionally unavailable. |
| CAPY-213 | Cloud machines | P2 | done | phase2-12 |  | `PUT /threads/:id/machine/keep-awake` holds the machine 4 h (wakes it first), `DELETE` cancels and the normal wind-down resumes; open preview `awake_until` windows also hold it: `machine-core.test.ts`, web `machine-core.test.tsx`. |
| CAPY-214 | Cloud machines | P2 | done | phase2-13 |  | Network posture API persists public/private/OIDC modes for pool machines; all modes keep no published host ports, private uses the per-thread internal Docker network, and OIDC fails closed when `FLOTILLA_OIDC_ISSUER` is absent: `machine-ux.test.ts`; UI selector in `machine-core.test.tsx`. |
| CAPY-215 | Cloud machines | P2 | blocked | phase2-13 |  | `/machine` + menu exposes a web shell with no SSH and the desktop action fails closed with 409. Blocked: pool machines do not run a desktop server yet, so the desktop half of the row is unavailable: `machine-ux.test.ts`, web `machine-core.test.tsx`. |
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
| CAPY-228 | Devices & desktop app | P2 | blocked | phase2-14 |  | Pairing-code claim, device bearer tokens, approval and revocation are proven, but Google/GitHub sign-in and a real flotilla-runner desktop pairing flow are absent. |
| CAPY-229 | Devices & desktop app | P2 | done | phase2-14 |  | Machine picker API returns cloud plus approved paired devices with status, platform, workspace policy and zero local machine metering metadata. |
| CAPY-230 | Devices & desktop app | P2 | done | phase2-14 |  | Device workspace policy persists new-worktree default, existing-worktree or current-checkout paths with validation. |
| CAPY-231 | Devices & desktop app | P2 | done | phase2-14 |  | Fixture scan links git folders by origin remote and authenticated device scan reports persist project folder metadata. |
| CAPY-232 | Devices & desktop app | P2 | blocked | phase2-14 |  | Paired devices carry machineMetering=none metadata, but runner execution/billing does not yet place or meter threads on devices. |
| CAPY-233 | Devices & desktop app | P2 | blocked | phase2-14 |  | The self-hosted API is central, but local threads cannot execute on paired devices yet, so browser follow/reply of a real local thread is unproven. |
| CAPY-234 | Devices & desktop app | P2 | blocked | phase2-14 |  | Device status and a 24 h wait-until timestamp are durable, but runner placement does not yet wait for device reconnect. |
| CAPY-235 | Devices & desktop app | P2 | blocked | phase2-14 |  | The cloud-checkpoints setting is durable, but checkpoint capture/upload of device worktrees is not implemented. |
| CAPY-236 | Devices & desktop app | P2 | blocked | phase2-14 |  | The move-to-cloud toggle is durable, but offline automatic migration is not implemented. |
| CAPY-237 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-238 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-239 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-240 | Devices & desktop app | P2 | blocked | phase2-14 |  | The keep-awake setting is durable, but no flotilla-runner power-management enforcement exists yet. |
| CAPY-241 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-242 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-243 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-244 | Devices & desktop app | P2 | blocked | phase2-15 |  |  Placement records container isolation and a git identity shape, but the runner does not yet execute on the paired device as the user or prove linked-folder sandboxing.  |
| CAPY-245 | Devices & desktop app | P2 | blocked | phase2-15 |  |  History import accepts explicit local-only requests but does not parse Claude Code/Codex histories or create threads.  |
| CAPY-246 | Devices & desktop app | P2 | blocked | phase2-15 |  |  No free-model execution policy exists for This Mac/no-plan device runs.  |
| CAPY-247 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-248 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-249 | Devices & desktop app | P2 | done | phase2-15 |  |  Per-device worktree validation requires an absolute local folder with at least 1 GB free.  |
| CAPY-250 | Dock CLI | P2 | blocked | phase2-16 |  |  Headless runner pairing/execution is not wired; this slice proves only local install, verification, directory and command semantics.  |
| CAPY-251 | Dock CLI | P2 | blocked | phase2-16 |  |  No curl-shell or PowerShell installer distribution path exists yet; root/admin refusal is proven in installer option validation only.  |
| CAPY-252 | Dock CLI | P2 | done | phase2-16 |  |  Fixture release verification checks sha256, macOS team and an ed25519 signed manifest.  |
| CAPY-253 | Dock CLI | P2 | done | phase2-16 |  |  Dock install env/flags cover base/home/bin/version/no-modify-path/allow-root.  |
| CAPY-254 | Dock CLI | P2 | done | phase2-16 |  |  Install layout creates versioned files, executable symlink and shell rc PATH unless disabled.  |
| CAPY-255 | Dock CLI | P2 | blocked | phase2-16 |  |  QR/link/code interactive first-run approval is not connected to the CLI.  |
| CAPY-256 | Dock CLI | P2 | done | phase2-16 |  |  Dock directories can be added, deduplicated, listed and removed.  |
| CAPY-257 | Dock CLI | P2 | blocked | phase2-16 |  |  Foreground supervision and tmux/systemd/launchd integration are not implemented.  |
| CAPY-258 | Dock CLI | P2 | done | phase2-16 |  |  status, doctor, dirs, verify and version commands return structured results, with verbose detail.  |
| CAPY-259 | Dock CLI | P2 | done | phase2-16 |  |  One-device-per-OS-user validation recommends dedicated accounts on shared servers.  |
| CAPY-260 | Dock CLI | P2 | blocked | phase2-16 |  |  Revocation is detected, but the next foreground run does not yet automatically re-pair.  |
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
| CAPY-280 | Drive | P2 | done | phase2-31 |  | Token-hashed read/write share links, revoke, anonymous read/write enforcement, and Shared links view proven in `drive-core.test.ts`; link creation/copy UI in `/drive` editor. |
| CAPY-281 | Drive | P2 | done | phase2-31 |  | Drive editor is available in the thread side pane; Markdown outline helper/UI proven in `drive-ux.test.ts`; append-only concurrent edits merge while replacements still conflict in `drive-core.test.ts`. |
| CAPY-282 | Drive | P2 | done | phase2-31 |  | Version-content API, compare endpoint, and pick-two-version UI proven in `drive-core.test.ts` and `drive-ux.test.ts`. |
| CAPY-283 | Drive | P2 | done | phase2-31 |  | 50-file Drive mount copy into a new-machine fake is built in under 1 s in `drive-core.test.ts` (real Docker machine timing unverified). |
| CAPY-284 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | Org (admin-only) and Personal instructions via `PUT /rules/instructions/{org,me}` plus per-project `PUT /projects/:id/rules` (owner); all are layered into every run prompt (rules.test.ts) and edited on `#/rules` (rules.spec.ts, mocked API). Agent CLIs still read the repo AGENTS.md natively. |
| CAPY-285 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | Root `AGENTS.md` wins over `CLAUDE.md` (fallback, reported `shadowed`); `.cursorrules`, `.windsurfrules`, `.clinerules`, `GEMINI.md`, `.github/copilot-instructions.md` are listed as `deprecated` and never injected. Read through the thread machine transport. |
| CAPY-286 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | A nested `AGENTS.md` is injected on the next turn after an `agent.tool_call` names a path in its subtree (`path`/`file_path`/`filePath`/`notebook_path`/`paths`/`files` inputs). Proven with a synthetic fake-adapter tool call; real vendor tool-input key names are unverified. |
| CAPY-287 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | `.capy/rules` and `.cursor/rules` `.md`/`.mdc` with `globs` (string, comma list or YAML list) or `alwaysApply`; glob rules apply when touched paths match. Injected through one runner `onBeforeRun` hook, so `fake` and `generic-cli` get byte-identical preambles (no adapter-name checks). |
| CAPY-288 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | One shared token budget (`FLOTILLA_RULES_MAX_TOKENS`, default 8000; tokens = ceil(chars/4), an estimate) across layers in order; an oversized layer ends with `[Flotilla truncated this layer: N of M tokens shown; shared context budget B tokens]`, later layers get 0. |
| CAPY-289 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | `GET /rules/guidance` (`RULES_GUIDANCE.whereToPut`, `antiPatterns`), shown on `#/rules`. |
| CAPY-290 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | `RULES_GUIDANCE.migration` covers Claude Code, Cursor and AGENTS.md agents (Codex and others); served by `GET /rules/guidance` and shown on `#/rules`. |
| CAPY-291 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | Kernel layer (no merge/protected push without an explicit ask, no secret exposure, no fabrication) is always first, never truncated and has no API to edit; enforcement stays in code via `assertPushAllowed` and `scrub` (asserted in rules.test.ts). Fabrication is prompt-only. |
| CAPY-292 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | Each run stores a per-layer token breakdown (no rule text) in `rules_context`; `GET /threads/:id/rules-context` (`/threads/:id/context` is the phase2-05 context meter) (owner) and the `#/rules` Context table show layer, source, tokens (truncated as `N of M`), budget and ignored files. |
| CAPY-293 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | Memory experiment: `POST/GET/DELETE /memory` (user or admin-set org scope), only while the effective Memory flag is on; the 50 newest entries become a `memory` layer in later threads of that user. Teaching is explicit (API/UI), not extracted from chats; Capy retention semantics unverified. |
| CAPY-294 | Instructions & rules | P2 | done | phase2-32 | https://github.com/flotilla-ai/flotilla/pull/53 | `GET/PUT /experiments` stores Memory and Captain flags per user and org (org needs admin); user value overrides org, default off. `#/rules` Experiments checkboxes. The Captain flag is stored and shown but nothing reads it yet. |
| CAPY-295 | Skills | P2 | done | phase2-33 | https://github.com/flotilla-ai/flotilla/pull/52 | Web/API invocation: `$name`, `/name`, `@name`, the name as words ("make a deck") or "<name> skill" (`parseInvocations`); runner prepends which SKILL.md to read and records `skill_invocations` (`GET /threads/:id/skills`); `POST /skills/resolve` previews. Slack `$name` resolution is a P3 Slack-unit integration (not built). |
| CAPY-296 | Skills | P2 | done | phase2-33 | https://github.com/flotilla-ai/flotilla/pull/52 | Nine built-in skills (`BUILTIN_SKILLS`) listed and copied each run into `/home/node/{.agents,.claude,.codex}/skills/<name>/` via driver `copyIn` (fake-driver tar test). Live Docker extraction/ownership in the thread image unverified. |
| CAPY-297 | Skills | P2 | done | phase2-33 | https://github.com/flotilla-ai/flotilla/pull/52 | Each run scans the checkout's `.agents/skills` and `.claude/skills` (bash+find on the machine transport; fixture repo test), caches them per project in `skills` and mounts them; `.agents` wins over `.claude`. |
| CAPY-298 | Skills | P2 | done | phase2-33 | https://github.com/flotilla-ai/flotilla/pull/52 | Drive skills (personal or project) and plugin skills are stored skill folders via `POST /skills` (source drive|plugin) and mount like the others. API only: no Drive file browser or plugin installer exists yet to create them from UI. |
| CAPY-299 | Skills | P2 | done | phase2-33 | https://github.com/flotilla-ai/flotilla/pull/52 | `parseSkillMd`/`validateSkill`: YAML frontmatter `name` + `description` required, name must match folder (lowercase-hyphen, <=64), description <=1024, folder <=256 KB; invalid folders are listed Not loaded with the reason. |
| CAPY-300 | Skills | P2 | done | phase2-33 | https://github.com/flotilla-ai/flotilla/pull/52 | `GET /skills` returns load state per folder (loaded / not-loaded+reason / replaced+by; precedence repo > Drive project > Drive personal > plugin > built-in); `PUT /skills/disabled` turns one off. Web `#/skills` page (personal or per-project picker) shows Loaded / Not loaded: <reason> / Replaced by <source> with Turn on/off (render test). |
| CAPY-301 | Skills | P2 | done | phase2-33 | https://github.com/flotilla-ai/flotilla/pull/52 | `POST /skills/import {from: claude-code|cursor|skills-cli, files}` copies `…/skills/<folder>/…` or `<folder>/…` trees into Drive skills keeping supporting files and origin. Reading those folders from the user's own disk (CLI/upload picker) is not built. |
| CAPY-302 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | Remote (Streamable HTTP) + STDIO registry; runner writes 0600 `/run/flotilla/mcp.json` and passes `mcpConfigPath` only when `capabilities.mcp`; live Claude `--mcp-config` load unverified. |
| CAPY-303 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | Server `key` is the config key and tool prefix (`mcp__<key>__<tool>`); unique per owner, 409 on clash. |
| CAPY-304 | MCP & plugins | P3 | done | phase3-07 |  |  Owner scope organization/user and all-project or one-project plugin rows resolve with user private override on key clash.  |
| CAPY-305 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | none / encrypted API-key headers / OAuth with refresh 60 s before expiry; `${VAR}` headers resolve from thread env vars; local OAuth fixture. |
| CAPY-306 | MCP & plugins | P3 | done | phase3-07 |  |  Per-member connection mode stores user-specific server credentials and marks private-threads-only plugins.  |
| CAPY-307 | MCP & plugins | P2 | needs-human-login | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | BYO client id/secret + PKCE + redirect `${FLOTILLA_PUBLIC_URL}/api/v1/mcp/oauth/callback` proven against a local token fixture; real provider sign-in needs a login (runlog). |
| CAPY-308 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | Agent proposal becomes a `kind=mcp` Review card (Approve/Decline); approve creates the server; web Review card on `#/mcp`. |
| CAPY-309 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | Import Claude Code JSON, Codex TOML subset, URL, command line (`POST /mcp/import`). |
| CAPY-310 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | Statuses, Test (config/auth/connect/initialize/tools) with failing step, 403 checklist; web row on `#/mcp`. STDIO connect checked on the thread machine only. |
| CAPY-311 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | Test/OAuth errors scrubbed of every configured value >=8 chars (exact, via core `scrubString`); MCP values also join run event scrubbing. |
| CAPY-312 | MCP & plugins | P4 | pending |  |  | Awaiting phase P4 unit. |
| CAPY-313 | MCP & plugins | P3 | done | phase3-07 |  |  GitHub repo/folder plugins load plugin.json plus mcp.json and support manual Sync.  |
| CAPY-314 | MCP & plugins | P3 | done | phase3-07 |  |  Install collects key values sealed in the vault; API exposes only key names and per-server connect state.  |
| CAPY-315 | MCP & plugins | P3 | done | phase3-07 |  |  Sync applies safe updates, requires approval when scopes/keys widen, and rollback restores a prior revision.  |
| CAPY-316 | MCP & plugins | P3 | done | phase3-07 |  |  Agent Plugins spec 1.0.0/1.1.0 manifests are validated and consumed.  |
| CAPY-317 | MCP & plugins | P2 | blocked | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | Proposal API `POST /threads/:id/mcp/proposals` + in-thread card proven; no agent-callable tool path from the thread machine yet (same gap as environment tools). |
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
| CAPY-341 | Billing & plans | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | Machine time is `machineSec` in `cost_entries` (runner 10 s ticker); 0023 trigger prices `machine-estimate` rows from the admin rate per runner type (`PUT /usage/settings` `machineRates`, µ$/min; default type `pool`). Report `machine[]` shows minutes/rate/usd. usage-billing-api.test.ts. |
| CAPY-342 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-343 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-344 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-345 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-346 | Billing & plans | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | `PUT /usage/budgets` sets global/project windows (`month` UTC calendar or `lifetime`, maxUsd, warnAt); before each run `runGates` pauses the thread with a budget approval (`monthly global budget`) once the window is spent; only this month counts; raising resumes. No auto-reload/billing. |
| CAPY-347 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-348 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-349 | Billing & plans | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-350 | Billing & plans | P3 | done | phase3-09 |  |  Workspace API reports Personal or Team from install membership with no billing attached.  |
| CAPY-351 | Billing & plans | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-352 | Usage & analytics | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | `/usage` web page (apps/web/src/features/usage-billing-api) shows window spend/tokens, budget windows and tables by member/model/thread/billing item (machine/free/subscription/key). Render test only; no browser e2e. |
| CAPY-353 | Usage & analytics | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | `GET /usage` report and `GET /usage/series?bucket=hour|day&by=member|item|thread|model` and `GET /usage/balance`; admins see the org, members only their own usage. |
| CAPY-354 | Usage & analytics | P3 | done | phase3-09 |  |  Activity analytics expose counts/cost metadata only and never private thread titles.  |
| CAPY-355 | Usage & analytics | P3 | done | phase3-09 |  |  Activity page shows Flotilla share of merged PRs, review-found issues, contributed PRs and agent hours.  |
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
| CAPY-399 | GitHub | P2 | done | phase2-35 |  | Fixture-backed account/installation store manages multiple personal/org accounts and installations with repositories and dependency-reader metadata (`github-integration.test.ts`). |
| CAPY-400 | GitHub | P2 | needs-human-login | phase2-35 |  | Personal-account API shape and acting identity settings exist, but live OAuth/PAT verification and acting as the user on GitHub need a human login. Operator command: connect a PAT/OAuth token, then run a fixture PR creation against a test repository. |
| CAPY-401 | GitHub | P2 | blocked | phase2-35 |  | Account-level and per-PR commit identity settings validate all four options, but commit/PR creation does not consume them yet. |
| CAPY-402 | GitHub | P2 | blocked | phase2-35 |  | Commit email is stored/validated, but Flotilla has no managed GPG key or signed-commit path. |
| CAPY-403 | GitHub | P2 | blocked | phase2-35 |  | Generic PR comment wakes exist, but `@capy` command parsing and the eyes reaction are not implemented. |
| CAPY-404 | GitHub | P2 | blocked | phase2-35 |  | Installations can record dependency-reader metadata, but no read-only dependency reader GitHub App/credential flow exists. |
| CAPY-405 | GitHub | P2 | done | phase2-35 |  | Installations fail closed unless contents/write, pull-requests/write, checks/read, issues/write and metadata/read are present (`github-integration.test.ts`). |
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
| CAPY-423 | Other integrations | P2 | needs-human-login | phase2-15 |  |  Fixture validation covers tagged ephemeral nodes, ACL shape, vault/secret OAuth references and disconnect state. Operator verification: set a real Tailscale OAuth client in the vault, put /api/v1/devices/:id/tailscale, then verify the tagged ephemeral node appears and disappears on disconnect.  |
| CAPY-424 | Other integrations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-425 | Other integrations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-426 | Other integrations | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-427 | UI surfaces | P3 | done | phase3-14 |  |  Sidebar model renders Captains, Pinned, folders and threads grouped by project, folder or none in a hybrid layout.  |
| CAPY-428 | UI surfaces | P3 | done | phase3-14 |  |  Bottom bar items support reorder and hide through persisted navigation preferences.  |
| CAPY-429 | UI surfaces | P3 | done | phase3-14 |  |  Folder visibility/no-nesting, pinned threads and at most twenty tags are modeled and validated.  |
| CAPY-430 | UI surfaces | P3 | done | phase3-14 |  |  Threads sidebar groups act as filterable saved-view foundations persisted in navigation preferences.  |
| CAPY-431 | UI surfaces | P3 | done | phase3-14 |  |  Command menu model searches threads, PRs, automations and settings with category pills and filters.  |
| CAPY-432 | UI surfaces | P3 | done | phase3-14 |  |  Thread pane tab vocabulary is represented in the tab/pane navigation slice.  |
| CAPY-433 | UI surfaces | P3 | done | phase3-14 |  |  Tab close others/right/all, reopen closed and middle-click close behavior is implemented.  |
| CAPY-434 | UI surfaces | P3 | done | phase3-14 |  |  Split right/down pane operations are implemented.  |
| CAPY-435 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-436 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-437 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-438 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-439 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-440 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-441 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-442 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-443 | Keyboard shortcuts | P3 | done | phase3-16 |  | Default/remappable command-menu, navigation and settings shortcuts are modeled and exposed in `/settings/shortcuts`.  |
| CAPY-444 | Keyboard shortcuts | P3 | done | phase3-16 |  | Thread jump/step shortcuts are represented in the remappable shortcut map.  |
| CAPY-445 | Keyboard shortcuts | P3 | done | phase3-16 |  | Shell, side-chat and tab shortcuts are represented in the remappable shortcut map.  |
| CAPY-446 | Keyboard shortcuts | P3 | done | phase3-16 |  | Thread menu, comment, annotate and model-favorite shortcuts are represented in the remappable shortcut map.  |
| CAPY-447 | Keyboard shortcuts | P3 | done | phase3-16 |  | Shortcut remap validation, conflict detection and local persistence are fixture-tested.  |
| CAPY-448 | Notifications | P3 | done | phase3-16 |  | Durable per-user notification settings API covers requests/failures/sounds/system/device/Slack preferences.  |
| CAPY-449 | Notifications | P3 | blocked | phase3-16 |  | Blocked: subscription storage exists, but signed Web Push/VAPID delivery while the browser is closed is not implemented.  |
| CAPY-450 | Notifications | P3 | done | phase3-16 |  | Captain/user @-mentions create durable mention notifications for matching users.  |
| CAPY-451 | Notifications | P3 | done | phase3-16 |  | Unread-count API and web badge/title helper are fixture-tested.  |
| CAPY-452 | Notifications | P3 | blocked | phase3-16 |  | Blocked: deterministic PR follow-up copy exists, but Slack DM delivery needs the missing Slack vendor integration.  |
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
| CAPY-464 | Support | P2 | done | phase2-37 |  | `docs/TROUBLESHOOTING.md` covers machine replacement, lost processes, setup/snapshot failure, credits, vendor reconnect, limits, ignored CI, waits, archived threads, ports/networking and MCP; exact topic index proof in `support-docs.test.ts`. |
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
| CAPY-477 | Cloud machines | P2 | done | phase2-13 |  | `POST /threads/:id/machine/resize` changes the project size, refuses a busy machine, sleeps/disposes the old container without deleting its workspace volume and boots a fresh larger container with the same thread workspace: `machine-ux.test.ts`. |
| CAPY-478 | Cloud machines | P2 | done | phase2-13 |  | Files API reads the persisted `flt-workspace-<thread>` volume through a networkless read-only helper without starting the lease; path escape fails closed and `/machine` has a files action: `machine-ux.test.ts`, web `machine-core.test.tsx`. |
| CAPY-479 | Cloud machines | P2 | done | phase2-13 |  | Web shell commands first wait briefly; still-running commands become durable `machine_background_commands` rows with pid/state/output and can be listed/stopped: `machine-ux.test.ts`, web `machine-core.test.tsx`. |
| CAPY-480 | Billing & plans | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-481 | Billing & plans | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | On run-out the switch onto the free models always asks (even with keep-going); admin `PUT /usage/settings {runOutFree:'never'}` drops the free option (Wait only). Fake run_out adapter; real vendor run-out detection stays under CAPY-333. |
| CAPY-482 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-483 | Models & connections | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-484 | Models & connections | P2 | needs-human-login | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | Proven offline: one list row per Claude model; a connected Claude subscription is first in run order (before an API key added earlier) and resolve picks it; production `defaultRunner` now registers the claude-code and codex adapters. Live: `claude auth login`, connect the subscription, run a thread on a Claude model and confirm it runs without ANTHROPIC_API_KEY. |
| CAPY-485 | Models & connections | P2 | blocked | phase2-04 | https://github.com/flotilla-ai/flotilla/pull/36 | Proven offline: PATCH `/api/v1/connections/:id` `{baseUrl}` (http/https only) reaches the next run as `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` (manifest `baseUrlEnvVar`). Blocked: no web connections editor yet (same web unit as CAPY-332). Live gateway: `ANTHROPIC_BASE_URL=<gateway> claude -p ok --bare` with the operator's key, unverified. |
| CAPY-486 | Models & connections | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-487 | Usage & analytics | P3 | done | phase3-09 |  |  By-member analytics rank by cost or tokens while cached tokens are reported separately rather than double-counted.  |
| CAPY-488 | Devices & desktop app | P2 | done | phase2-15 |  |  Worktree folder policy is stored per paired device and exposed by the API.  |
| CAPY-489 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-490 | Devices & desktop app | P2 | blocked | phase2-15 |  |  Placement API distinguishes cloud/paired device and waiting-reconnect, but thread rows do not yet render that placement or execute the reconnect handoff.  |
| CAPY-491 | Devices & desktop app | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-492 | Captains | P2 | done | phase2-21 |  | API creates a crew thread in the Captain project and adds/removes crew membership. |
| CAPY-493 | Captains | P2 | done | phase2-21 |  | Captain photo upload stores bounded png/jpeg/webp bytes and org library selection is supported. |
| CAPY-494 | Captains | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-495 | Captains | P2 | blocked | phase2-22 |  | Large crew/subagent lists are not virtualized. |
| CAPY-496 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-497 | Issues | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-498 | Review | P2 | done | phase2-24 |  | Review state and finding triage are exposed through the REST API. |
| CAPY-499 | Review | P2 | done| phase2-25 |  | Stack badge detection covers graphite, spr and manual branch chains. |
| CAPY-500 | Automations | P2 | done | phase2-26 |  | Multiple schedule triggers per automation are stored and scanned independently. |
| CAPY-501 | Automations | P2 | done | phase2-27 |  | Automation list API filters by state and creation date; project scoping is inherent in the project list endpoint. |
| CAPY-502 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | Usage is summed as bigint; a Drive at >2 GiB accepts saves up to its quota (drive-core.test.ts, sizes recorded without writing 2 GiB). |
| CAPY-503 | Drive | P2 | done | phase2-30 | https://github.com/flotilla-ai/flotilla/pull/51 | Mount/save failures insert a non-blocking `approvals` card with `detail.drive={code,title,nextStep}`; the run still starts (drive-core.test.ts). |
| CAPY-504 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-505 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-506 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-507 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-508 | UI surfaces | P3 | done | phase3-14 |  |  Pages-at-top, collapsible/hideable sidebar sections and customization preferences persist locally.  |
| CAPY-509 | UI surfaces | P3 | done | phase3-14 |  |  Preview tabs close when moving on and double-click/keep semantics are modeled.  |
| CAPY-510 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-511 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-512 | UI surfaces | P3 | done | phase3-14 |  |  Onboarding steps persist locally and joiners skip organization setup.  |
| CAPY-513 | UI surfaces | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-514 | SSO & sign-in | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-515 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-516 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-517 | Slack | P3 | pending |  |  | Awaiting phase P3 unit. |
| CAPY-518 | GitHub | P2 | done | phase2-35 |  | Admin `DELETE /github/accounts/:id` revokes the account and installations; non-owner members get 404 (`github-integration.test.ts`). |
| CAPY-519 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | rename / enable / widen proposals answered via `/approvals/:id/answer` apply in one click; decline leaves the server unchanged. |
| CAPY-520 | MCP & plugins | P2 | done | phase2-34 | https://github.com/flotilla-ai/flotilla/pull/55 | OAuth start returns "Finish in your browser"; row shows Cancel; cancelled flows cannot complete (404). |
| CAPY-521 | API: automations | P2 | done | phase2-28 |  | List batches API. |
| CAPY-522 | API: automations | P2 | done | phase2-28 |  | Flush batch API. |
| CAPY-523 | API: automations | P2 | done | phase2-28 |  | Cancel batch API. |
| CAPY-524 | API: automations | P2 | done | phase2-28 |  | List automations API. |
| CAPY-525 | API: automations | P2 | done | phase2-28 |  | Create automation API. |
| CAPY-526 | API: automations | P2 | done | phase2-28 |  | Get automation API. |
| CAPY-527 | API: automations | P2 | done | phase2-28 |  | Update automation API. |
| CAPY-528 | API: automations | P2 | done | phase2-28 |  | Rotate webhook API. |
| CAPY-529 | API: automations | P2 | done | phase2-28 |  | Trigger automation API. |
| CAPY-530 | API: automations | P2 | done | phase2-28 |  | List runs API. |
| CAPY-531 | API: automations | P2 | done | phase2-28 |  | Cancel run API. |
| CAPY-532 | API: automations | P2 | done | phase2-28 |  | Enable automation API. |
| CAPY-533 | API: automations | P2 | done | phase2-28 |  | Disable automation API. |
| CAPY-534 | API: automations | P2 | done | phase2-28 |  | Delete automation API. |
| CAPY-535 | API: automations | P2 | done | phase2-28 |  | Restore automation API. |
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
| CAPY-555 | API: captains | P2 | done | phase2-21 |  | List Captains endpoint returns owned active Captains. |
| CAPY-556 | API: captains | P2 | done | phase2-21 |  | Create Captain endpoint validates project and crew concurrency. |
| CAPY-557 | API: captains | P2 | done | phase2-21 |  | Get Captain endpoint returns thread and Captain metadata. |
| CAPY-558 | API: captains | P2 | done | phase2-21 |  | List Captain crew endpoint returns member threads. |
| CAPY-559 | API: captains | P2 | done | phase2-21 |  | Add crew endpoint enforces ownership/project membership rules. |
| CAPY-560 | API: captains | P2 | done | phase2-21 |  | Remove crew endpoint deletes membership or returns 404. |
| CAPY-561 | API: captains | P2 | done | phase2-21 |  | Get Captain digest endpoint returns durable digest Markdown. |
| CAPY-562 | API: folders | P3 | done | phase3-17 | #82 |  Folder list API derives visible non-archived thread folders with counts.  |
| CAPY-563 | API: folders | P3 | done | phase3-17 | #82 |  Folder threads API lists visible threads filed in a folder.  |
| CAPY-564 | API: folders | P3 | done | phase3-17 | #82 |  File API moves a thread into a folder through lifecycle events.  |
| CAPY-565 | API: folders | P3 | done | phase3-17 | #82 |  Unfile API clears a thread folder through lifecycle events.  |
| CAPY-566 | API: folders | P3 | done | phase3-17 | #82 |  Pin API pins a thread through lifecycle events.  |
| CAPY-567 | API: folders | P3 | done | phase3-17 | #82 |  Unpin API clears the pinned flag through lifecycle events.  |
| CAPY-568 | API: issues | P3 | done | phase3-18 | #84 |  List issues supports state, assignee, label and text filters.  |
| CAPY-569 | API: issues | P3 | done | phase3-18 | #84 |  Create issue validates state, assignee, labels, due date and uploaded file ids.  |
| CAPY-570 | API: issues | P3 | done | phase3-18 | #84 |  Get issue works by durable id or identifier.  |
| CAPY-571 | API: issues | P3 | done | phase3-18 | #84 |  Update issue edits core fields and records timeline events.  |
| CAPY-572 | API: issues | P3 | done | phase3-18 | #84 |  List issue comments returns durable comments in order.  |
| CAPY-573 | API: issues | P3 | done | phase3-18 | #84 |  Comment on issue stores author and body.  |
| CAPY-574 | API: issues | P3 | done | phase3-18 | #84 |  Issue timeline merges durable events and comments chronologically.  |
| CAPY-575 | API: issues | P3 | done | phase3-18 | #84 |  List issue relations returns outgoing and incoming relations.  |
| CAPY-576 | API: issues | P3 | done | phase3-18 | #84 |  Relate issues supports relates, blocks and parent types.  |
| CAPY-577 | API: issues | P3 | done | phase3-18 | #84 |  Remove issue relation deletes either side of a relation.  |
| CAPY-578 | API: issues | P3 | done | phase3-18 | #84 |  Link pull request or thread stores typed durable links.  |
| CAPY-579 | API: issues | P3 | done | phase3-18 | #84 |  Unlink pull request or thread removes durable links.  |
| CAPY-580 | API: issues | P3 | done | phase3-18 | #84 |  Download issue file streams attached bytes exactly.  |
| CAPY-581 | API: issues | P3 | done | phase3-18 | #84 |  List issue states returns ordered custom states.  |
| CAPY-582 | API: issues | P3 | done | phase3-18 | #84 |  Create issue state appends a durable custom state.  |
| CAPY-583 | API: issues | P3 | done | phase3-18 | #84 |  Reorder issue states atomically rewrites the full order.  |
| CAPY-584 | API: issues | P3 | done | phase3-18 | #84 |  Delete issue state refuses default or in-use states and otherwise removes it.  |
| CAPY-585 | API: issues | P3 | done | phase3-18 | #84 |  Update issue state renames a durable custom state.  |
| CAPY-586 | API: issues | P3 | done | phase3-18 | #84 |  Set default issue state makes exactly one state default.  |
| CAPY-587 | API: issues | P3 | done | phase3-18 | #84 |  List issue labels returns durable labels.  |
| CAPY-588 | API: issues | P3 | done | phase3-18 | #84 |  Create issue label validates name, color and description.  |
| CAPY-589 | API: issues | P3 | done | phase3-18 | #84 |  Delete issue label removes references from issues.  |
| CAPY-590 | API: issues | P3 | done | phase3-18 | #84 |  Update issue label edits name, color and description.  |
| CAPY-591 | API: issues | P3 | done | phase3-18 | #84 |  Get issue prefix returns the organization prefix.  |
| CAPY-592 | API: issues | P3 | done | phase3-18 | #84 |  Set issue prefix validates and uses the prefix for new identifiers.  |
| CAPY-593 | API: subagents | P2 | done | phase2-19 |  | `GET /threads/:id/subagents` lists child subagents; regression in `subagent-core.test.ts`. |
| CAPY-594 | API: subagents | P2 | done | phase2-19 |  | `GET /subagents/:id` returns one owned subagent; regression in `subagent-core.test.ts`. |
| CAPY-595 | API: subagents | P2 | done | phase2-19 |  | `GET /subagents/:id/messages` serves ordered event-store messages with owner validation; regression in `subagent-core.test.ts`. |
| CAPY-596 | API: tasks | P3 | done | phase3-19 | #85 |  List tasks legacy alias returns visible thread-backed tasks.  |
| CAPY-597 | API: tasks | P3 | done | phase3-19 | #85 |  Get task legacy alias returns one visible thread-backed task.  |
| CAPY-598 | API: tasks | P3 | done | phase3-19 | #85 |  List task messages legacy alias returns durable user and agent messages.  |
| CAPY-599 | API: messages | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-600 | API: messages | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-601 | API: messages | P2 | done | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | GET `/threads/:id/inbox/:item/versions` lists all versions of a message. |
| CAPY-602 | API: messages | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-603 | API: messages | P2 | done | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | DELETE `/threads/:id/inbox/:item` cancels a queued message. |
| CAPY-604 | API: messages | P2 | done | phase2-05 | https://github.com/flotilla-ai/flotilla/pull/34 | POST `/threads/:id/inbox/:item/send` jumps the queue and interrupts (or steers) the current turn. |
| CAPY-605 | API: files | P3 | done | phase3-17 | #82 |  Upload grants and byte-exact completion were already in the API platform and are covered by the focused test.  |
| CAPY-606 | API: attachments | P3 | done | phase3-17 | #82 |  Uploaded files/attachments list with cursor pagination through the API platform.  |
| CAPY-607 | API: attachments | P3 | done | phase3-17 | #82 |  Owner-scoped download endpoint streams stored bytes with content type and attachment filename.  |
| CAPY-608 | API: streams | P1 | done | phase1 | https://github.com/flotilla-ai/flotilla/pull/1 | Covered by merged phase 1 scope; row-specific proof is in the linked phase-1 runlog where available. |
| CAPY-609 | API: streams | P2 | done | phase2-19 |  | `GET /subagents/:id/stream` serves SSE directly from the Flotilla event store; regression in `subagent-core.test.ts`. |
| CAPY-610 | API: streams | P2 | done | phase2-19 |  | `GET /threads/:id/stream` task SSE is served from the Flotilla event store; regression in `subagent-core.test.ts`. |
| CAPY-611 | API: reviews | P3 | done | phase3-19 | #85 |  Get review settings returns durable per-repo automatic/posting options.  |
| CAPY-612 | API: reviews | P3 | done | phase3-19 | #85 |  Configure review settings updates durable per-repo automatic/posting options.  |
| CAPY-613 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-614 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-615 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-616 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-617 | API: reviews | n/a | n-a |  |  | Out of self-hosted scope per Appendix A. |
| CAPY-618 | API: reviews | P3 | done | phase3-19 | #85 |  Start review creates a validated exact-head read-only review run.  |
| CAPY-619 | API: reviews | P3 | done | phase3-19 | #85 |  Round returns one owned review run and its findings.  |
| CAPY-620 | API: reviews | P3 | done | phase3-19 | #85 |  Pull returns pull-request review state, findings and readiness.  |
| CAPY-621 | API: reviews | P3 | done | phase3-19 | #85 |  Update finding statuses batch-triages findings with GitHub-thread state projection.  |
| CAPY-622 | API: reviewRules | P3 | done | phase3-20 | #86 |  Get review rule returns one owner-scoped durable rule.  |
| CAPY-623 | API: reviewRules | P3 | done | phase3-20 | #86 |  Delete review rule removes one owner-scoped durable rule.  |
| CAPY-624 | API: reviewRules | P3 | done | phase3-20 | #86 |  Update review rule edits text and enabled state.  |
| CAPY-625 | API: reviewRules | P3 | done | phase3-20 | #86 |  List review rules supports optional repo filtering.  |
| CAPY-626 | API: reviewRules | P3 | done | phase3-20 | #86 |  Create review rule validates repo and text with duplicate conflicts.  |
| CAPY-627 | API: reviewFilters | P3 | done | phase3-20 | #86 |  List review filter rules supports optional repo filtering.  |
| CAPY-628 | API: reviewFilters | P3 | done | phase3-20 | #86 |  Create review filter rule validates scope, action and pattern.  |
| CAPY-629 | API: reviewFilters | P3 | done | phase3-20 | #86 |  Delete review filter rule removes one owner-scoped row.  |
| CAPY-630 | API: reviewFilters | P3 | done | phase3-20 | #86 |  Update review filter rule edits scope, action, pattern and enabled state.  |
| CAPY-631 | API: reviewFilters | P3 | done | phase3-20 | #86 |  List review ignore paths supports optional repo filtering.  |
| CAPY-632 | API: reviewFilters | P3 | done | phase3-20 | #86 |  Create review ignore path validates repo and path.  |
| CAPY-633 | API: reviewFilters | P3 | done | phase3-20 | #86 |  Delete review ignore path removes one owner-scoped row.  |
| CAPY-634 | API: reviewFilters | P3 | done | phase3-20 | #86 |  Update review ignore path edits path and enabled state.  |
| CAPY-635 | API: usage | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | `GET /api/v1/usage?from&to` returns `UsageReport` (totals + byMember/byModel/byThread/byItem + machine); session or API key. |
| CAPY-636 | API: usage | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | `GET /api/v1/usage/series` returns `UsageSeries` points per UTC hour/day bucket and group key. |
| CAPY-637 | API: usage | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | `GET /api/v1/usage/balance` returns `BudgetWindow[]` (spent, reserved holds, remaining, ok/warn/hit); works with an API key. |
| CAPY-638 | API: users | P3 | done | phase3-17 | #82 |  Organization users API lists non-service users with id, email and role.  |
| CAPY-639 | API: models | P2 | done | phase2-36 | https://github.com/flotilla-ai/flotilla/pull/54 | Existing `GET /api/v1/models` (phase2-04) proven with a bearer API key: catalog rows with connections; not duplicated. |
