# Blocked-row triage (unblock run)

Base: `flotilla/p1` at `f08de2a`. 199 rows are `blocked`; 24 are `needs-human-login` (bucket C, untouched except the two A-parts below). The cause column is copied from the `note` column of `docs/plan/PARITY.md`.

Bucket A = buildable now, no new access. Bucket B = needs a mock, fake or tool set up in the VM. Bucket C = mehdi only.

## A1: web UI on existing APIs (19 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-009 | unblock-02 | Edit a queued/steered message before the agent reads it; send now / discard / return to composer | Server/API proven in runner-queue.test.ts: PATCH/DELETE `/threads/:id/inbox/:item` edit or discard a pending message; 409 once the agent read it. Blocked: web UI (edit/discard control on queued messages) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-010 | unblock-02 | Edit a sent message; thread continues from new version with a version switcher | Server/API proven in runner-queue.test.ts: POST `/threads/:id/inbox/:item/versions` adds version n+1 (same root) and continues from it in a new session (no adapter rewind yet). Blocked: web UI (sent-message edit and version switcher) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-026 | unblock-02 | Context meter + 'Compact at' per thread, org default | Server/API proven in runner-queue.test.ts: GET/PATCH `/threads/:id/context`: used tokens from the last run; Compact at is editable only when the adapter declares `compaction`. Blocked: web UI (context meter and Compact-at control) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-043 | unblock-04 | Per-event response setting: React / Keep as context / Ignore; org tab + personal override | Server proven: `wake_settings` org + personal (field-by-field), React/Keep as context/Ignore per event, `GET/PUT /wake-settings/{org,me}` (org admin-only), context items prefix the next react. Blocked: no web settings screen in budget. |
| CAPY-050 | unblock-04 | Thread on someone's computer holds incoming messages until owner allows | Hold/allow proven: `PUT /threads/:id/hold`, held items in `wake_inbox`, owner-only allow/decline. Blocked: BYOM threads do not auto-enable hold and there is no held-messages UI (BYOM is a later unit). |
| CAPY-067 | unblock-05 | New Captain dialog: name, face/avatar, project, machine, model, access | New-Captain backend exists, but the required dialog with name/face/project/machine/model/access is not implemented in the web UI; blocked on that UI slice. |
| CAPY-078 | unblock-05 | Filter Pull requests page by Captain | Pull-requests page has no Captain filter control; no UI integration is implemented. |
| CAPY-098 | unblock-05 | Captains-first / Hybrid sidebar, pinned Captain faces, each row shows the question it waits on | Captains-first/hybrid sidebar with pinned faces and waiting questions is not implemented. |
| CAPY-153 | unblock-05 | Manage on Automations page or by asking the agent (full automation tools) | Automation API exists, but neither an Automations page nor agent-accessible full management tools are implemented. |
| CAPY-332 | unblock-04 | Model picker badges (subscription/key/credits), tooltip names connection; favorites with ⌥1–9 | blocked: the row is the web model picker (badges, connection tooltip, Alt+1…9 favorites) and `apps/web` is outside phase2-03 SCOPE; the server API returning badges, tooltips, favorites and shortcuts is proven (models-catalog.test.ts). Needs a web picker unit. |
| CAPY-465 | unblock-03 | /plan prefix: explore and ask first, change nothing until plan approved (Slack, Linear, API too) | Server/API proven in runner-queue.test.ts: `/plan` prefixes PLAN_PROMPT, opens a blocking `gate='plan'` approval, skips after-run hooks and holds the inbox until approved. Blocked: web UI (/plan composer command and plan-approval card) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-466 | unblock-03 | /btw opens a side thread like /side; hold Alt+M to talk | Server/API proven in runner-queue.test.ts: `/btw <q>` creates a child thread (`parent_id`) and emits `thread.side` on the parent. Blocked: web UI (/btw side-thread panel) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-467 | unblock-02 | Send while a file is still uploading; goes out after upload, survives reload | Server/API proven in runner-queue.test.ts: Messages with un-uploaded owned files wait as `waiting_upload` and are released by `resumePending()` (also after restart). Blocked: web UI (pending-upload indicator on the composer) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-468 | unblock-02 | Two or more queued messages fold behind a count above composer | Server/API proven in runner-queue.test.ts: GET `/threads/:id/inbox` returns `queuedCount` and `folded` (>=2). Blocked: web UI (folded queue count) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-469 | unblock-03 | Retry on provider error with no message to type; error card offers Retry or another model on own key | Server/API proven in runner-queue.test.ts: Adapter errors are classified (`runs.error`, `run.ended.error`); POST `/threads/:id/retry` re-sends the last message, optionally with another model/connection. Blocked: web UI (retry/error card with model switch) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-470 | unblock-03 | Request cards: Later / Dismiss, synced across devices; Captain gathers crew questions with Dismiss all | Server/API proven in runner-queue.test.ts: POST `/approvals/:id/later` (snooze) and `/dismiss`, POST `/captains/:id/approvals/dismiss`; each emits `approval.updated`. Blocked: web UI (request cards with Later/Dismiss and Captain dismiss-all) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-476 | unblock-03 | Codemode: agent writes programs that call tools; inner tool calls shown live | Server/API proven in runner-queue.test.ts: Nested tool calls/results keep `parentId` in live `agent.tool_*` events. Blocked: web UI (nested codemode tool-call display) not built in phase2-05 (server-only slice within diff budget); needs a web unit. |
| CAPY-485 | unblock-04 | Change a connection's Base URL | Proven offline: PATCH `/api/v1/connections/:id` `{baseUrl}` (http/https only) reaches the next run as `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` (manifest `baseUrlEnvVar`). Blocked: no web connections editor yet (same web unit as CAPY-332). Live gateway: `ANTHROPIC_BASE_URL=<gateway> claude -p ok --bare` with the operator's key, unverified. |
| CAPY-495 | unblock-05 | Large crews / hundreds of subagents render without freezing | Large crew/subagent lists are not virtualized. |

## A2: issues web app (9 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-101 | unblock-06 | Built-in issue tracker: For you / Assigned / Mentioned views, filters (status, assignee, labels, due date, relations…) | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-102 | unblock-06 | Issue relations (blocks, relates), sub-issues, labels, due date, linked PRs/threads | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-103 | unblock-06 | Threads file, update and close issues; owning thread wakes on comments | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-104 | unblock-07 | Issues board (columns per status, drag, bulk move, undo, keyboard) | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-105 | unblock-07 | Saved issue views; editable title; reply to/edit comments in place | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-106 | unblock-07 | Custom issue states (create/order/default), labels, issue prefix | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-107 | unblock-06 | Issue comments, timeline, file downloads | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-496 | unblock-07 | Display menu groups/orders issues, hides row properties; comments tag skills/PRs/files | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |
| CAPY-497 | unblock-51 | Click status icon to change status; Capy issue links unfurl in Slack | Blocked: the public issues API exists, but the full issue web application (board, saved views, relations UX, inline comments, Slack unfurl) is not implemented. |

## A3: PR page wiring on the fixture gateway (8 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-111 | unblock-08 | Open PRs as Ready or Draft (org default + personal override, per-PR by asking) | Org/personal draft defaults are durable, but per-PR draft changes by asking the agent are not wired. |
| CAPY-112 | unblock-08 | 'Open in Capy' button in PR description (toggle) | Open-in-Flotilla preference is durable, but PR creation does not yet write the button into descriptions. |
| CAPY-113 | unblock-08 | Capy PR page at capy.ai/pull/<owner>/<repo>/<n>; Cmd+K by URL/owner/repo#n/title | Pulls exist at /pulls, but exact /pull/<owner>/<repo>/<n> routing and Cmd+K lookup are outside the implemented slice. |
| CAPY-114 | unblock-08 | Chat with Capy / New thread with PR from the PR page | Pull detail exposes chat/new-thread links, but they do not yet create a thread preloaded with PR context. |
| CAPY-126 | unblock-08 | PR status on idle sidebar rows (Checks / PR failing / PR ready) | PR status exists in pull data but the thread sidebar has no extension point inside this unit scope. |
| CAPY-134 | unblock-09 | Start review from PR page, '@capy review <instructions>', or API | API and source labels exist, but PR-page buttons and @mention ingestion are not connected. |
| CAPY-401 | unblock-09 | Commit author options (You+Capy co-author default, You, Capy+you, Capy); per-PR override; API pullRequestAuthor | Account-level and per-PR commit identity settings validate all four options, but commit/PR creation does not consume them yet. |
| CAPY-403 | unblock-09 | @capy <message> / @capy review on PRs; 👀 reaction | Generic PR comment wakes exist, but `@capy` command parsing and the eyes reaction are not implemented. |

## A4: agent-callable tools, Captain lifecycle, background model (12 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-062 | unblock-10 | Sibling threads created and messaged by a coordinating agent | Siblings are created and messaged through the user-authenticated subagent API; no agent-callable tool for non-Captain threads exists (Captain `crew.*` MCP tools are outside this unit). |
| CAPY-069 | unblock-11 | Promote a folder: its threads join the crew, folder removed | Flotilla has no folder entity/folder removal workflow, so folder promotion cannot currently move folder threads into a crew. |
| CAPY-070 | unblock-10 | Create a Captain by asking any thread ('Make a Captain called Mobile…') | Natural-language “Make a Captain…” creation through an existing thread is not implemented; only direct Captain create/promote APIs exist. |
| CAPY-072 | unblock-11 | Demote to thread / Archive (puts crew to sleep) / Unarchive / Delete (crew returns to list) | Crew archive/release API exists, but Captain archive does not yet put crew machines to sleep and delete/demote lifecycle is incomplete. |
| CAPY-076 | unblock-11 | Crew threads open beside the Captain's chat; Captain hears each crew turn end / need | Crew lifecycle events exist in the scheduler, but turn-end/need wiring into this operations surface and beside-chat UI is not connected. |
| CAPY-077 | unblock-11 | Captain hears when a crew thread answered you directly | No runner/crew event currently reports that a crew thread answered the user directly. |
| CAPY-095 | unblock-11 | Captains on a schedule via automations; automations/Slack hand Captain new tickets | Automations still create ordinary threads and cannot yet hand work to or start Captain threads. |
| CAPY-099 | unblock-11 | Captain starts work on a change you mention in passing | No chat observer starts work from a passing mention. |
| CAPY-163 | unblock-12 | run_when gate: a free fast-model check of fuzzy conditions | run_when is stored and injectable for fixture proof, but production has no configurable free fast-model gate adapter wired yet. |
| CAPY-190 | unblock-10 | Agent can read/replace whole setup via environment tools (with boundaries) | `environment.read`/`environment.replace` (whole spec, validated, stale `baseVersion` refused, own project only) via `POST /threads/:id/environment/tools/:name`. Blocked: not yet in the Captain/agent tool registry; verify needs a registered machine, which phase2-12 machine core now provides at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). |
| CAPY-317 | unblock-10 | Agent proposes missing plugin in-thread | Proposal API `POST /threads/:id/mcp/proposals` + in-thread card proven; no agent-callable tool path from the thread machine yet (same gap as environment tools). |
| CAPY-338 | unblock-12 | Background requests (titles, PR summaries) on Capy's ZDR accounts | `POST /api/v1/models/background` resolves the user's policy `background` model, else the thread's own, under the same policy and connections (no hosted account) — proven. Blocked: phase2-07's `TitleGenerator` is the offline heuristic and no PR-summary generator exists; a model-backed generator that runs on this resolver's selection is still needed (owner: the unit adding model-generated titles/PR summaries). |

## A5: machine executor for background jobs and automations (4 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-046 | unblock-13 | Long-running background command with explicit timeout (default 30 min, max 6 h) keeps machine awake while waited on | Router proven with a fake executor: default 30 min, max 6 h timeout, $ cap, wake on exit/timeout, `keepAwake` flag. Blocked: no machine idle-stop consumes `keepAwake` yet (phase2-12), and production has no machine executor yet (jobs return Conflict). |
| CAPY-171 | unblock-13 | Automation Drive scope (state between runs) | Automation drive_scope metadata is durable, but Drive state is not yet mounted into automation runs. |
| CAPY-172 | unblock-13 | Per-run machine size | Per-automation machine_size is durable, but runner machine placement does not consume it yet. |
| CAPY-175 | unblock-13 | Failed run kept with full thread and output | Failed automation runs and thread references are retained, but runner output/completion is not yet written back to automation_runs.output. |

## A6: review agent on a real machine checkout, environment on pool machines (9 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-130 | unblock-14 | Dedicated review agent in a real checkout at the PR's exact head | Review runs are durable/read-only/head-pinned metadata, but no real machine checkout or review agent execution is wired yet. |
| CAPY-137 | unblock-14 | Reviews never run on your own keys/subscriptions | Review runs record adapter/connection selection, but no policy yet prevents use of owner keys/subscriptions. |
| CAPY-151 | unblock-14 | Review machines read-only (can't push); 4 GB default | Review machine read-only enforcement and the 4 GB default are not wired to machine provisioning. |
| CAPY-183 | unblock-15 | Dev environment per repo: scripts, startup entries, commands, snapshots; versioned shared history | Versioned per-project `EnvironmentSpec` (setup phases, startup entries, commands) with shared history: `environments.test.ts`, UI `apps/web/e2e/environments.spec.ts`. Blocked remainder: container snapshot (phase2-11); phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). |
| CAPY-184 | unblock-15 | 'Ask Capy to set up' (capy-setup skill) writes and verifies setup on its own machine | `environment.verify` runs initialize on the thread machine and records the verdict on the version (local-process machine fixture). Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no "Ask to set up" button. |
| CAPY-185 | unblock-15 | initialize phase (fresh clone; 900 s default) and refresh phase (checkout moved; 300 s); timeouts 60–3600 s | initialize 900 s / refresh 300 s defaults, 60-3600 s validation, timeout kill, fresh-clone vs moved-checkout `choosePhase`, proven with a local-process machine. Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no test asserts initialize/refresh selection on a pool-booted machine. |
| CAPY-187 | unblock-15 | Scripts run in bash from repo dir as sudo user with env vars | `bash -c` from `caps.repoDir` with thread env and `FLOTILLA_SUDO` from machine caps (off by default, so BYOM gets no sudo). Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: running as the sudo user is machine-image work (phase2-12). |
| CAPY-188 | unblock-15 | Commands: named on-demand actions (test, build, db reset) | `POST /threads/:id/environment/commands/:name` runs a named command on the registered machine and records state. Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no test runs a named command on a pool-booted machine. |
| CAPY-212 | unblock-15 | 14-day sleeping machine deletion; rebuild from dev environment if resume fails | Warns a day ahead (`machine.state` event). Deletion now fails closed: without a successful pre-delete WIP-capture hook the lease remains sleeping and the workspace volume is retained; a failed wake restores the prior lease without deleting the workspace: `machine-core.test.ts`. Blocked: production `beforeDelete` does not push WIP, so real 14-day workspace deletion/rebuild is intentionally unavailable. |

## A7: side chat and forks (3 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-063 | unblock-16 | Side chat: full copy on same machine, opens as a tab, sees uncommitted changes (/side, Cmd+Shift+S) | Side chat requires a same-machine full workspace/session copy and tab UX; only the subagent API vertical slice fit this unit. Blocked: no machine workspace clone/session-copy primitive or thread tab UI yet. |
| CAPY-064 | unblock-16 | Fork: full copy (/fork) or summary (/fork-summary) on a fresh machine; 'Fork of …' | Fork/summary-fork requires adapter session copy for full forks plus fresh-machine workspace copy; summary-fork can use any adapter but still needs the fork lifecycle. Blocked: no fork API/workspace clone primitive yet. |
| CAPY-065 | unblock-16 | Select text to fork or side-chat from that passage | Passage fork/side-chat depends on the blocked fork/side-chat primitives plus composer passage selection UI; no such selection/fork workflow exists yet. |

## A8: multi-org service, then shared projects (12 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-182 | unblock-19 | Private projects | Proven: `visibility` is `private` by default, and private projects are hidden (404) from other users and only the owner edits or clones. Blocked: the non-private counterpart is not usable by teammates. `shared` projects are listed and readable, but `ThreadRunner.create` and Captain creation still require `projects.owner_id`, so collaborator use needs P3 org membership. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`. |
| CAPY-357 | unblock-17 | Roles Owner/Admin/Member; multiple owners | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-358 | unblock-17 | Invite by email; revoke pending | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-359 | unblock-17 | Join by verified email domain | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-360 | unblock-17 | Promote/demote/remove; leave via admin | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-361 | unblock-18 | Service users with roles, project access, subscription grants | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-362 | unblock-18 | Visibility: shared vs private for projects, threads, Captains, folders; /private, /shared | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-363 | unblock-18 | Org sharing settings: Private work toggle, default access, member default | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-364 | unblock-17 | Multiple organizations; org switch; create second org | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-365 | unblock-18 | Delete/restore organization; delete account | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-366 | unblock-18 | Work from departed members; transfer thread/Captain/project | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |
| CAPY-367 | unblock-18 | Audit log | Blocked: Flotilla still lacks a first-class multi-organization membership/administration service for roles, invitations, visibility, transfer, deletion, and audit-log workflows. |

## A9: org provider connections and model policy (6 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-323 | unblock-20 | Azure (organization) models | Blocked: the model catalog exists, but provider-specific organization connections, fast/ultrafast modes, approval sharing, and Slack/Linear default-model policy surfaces are not implemented. |
| CAPY-324 | unblock-20 | Fast mode (priority tier) with fallback to standard | Blocked: the model catalog exists, but provider-specific organization connections, fast/ultrafast modes, approval sharing, and Slack/Linear default-model policy surfaces are not implemented. |
| CAPY-326 | unblock-20 | Modes: fast, pro, ultrafast, daybreak | Blocked: the model catalog exists, but provider-specific organization connections, fast/ultrafast modes, approval sharing, and Slack/Linear default-model policy surfaces are not implemented. |
| CAPY-334 | unblock-20 | Org settings: members can connect own; members choose run-out; Only <key>; Turn off model; Compact at | Blocked: the model catalog exists, but provider-specific organization connections, fast/ultrafast modes, approval sharing, and Slack/Linear default-model policy surfaces are not implemented. |
| CAPY-482 | unblock-20 | Anyone who can see the thread can approve credits; one approval covers a Captain's crew | Blocked: the model catalog exists, but provider-specific organization connections, fast/ultrafast modes, approval sharing, and Slack/Linear default-model policy surfaces are not implemented. |
| CAPY-483 | unblock-51 | Default model for Slack mentions and Linear threads + personal default | Blocked: the model catalog exists, but provider-specific organization connections, fast/ultrafast modes, approval sharing, and Slack/Linear default-model policy surfaces are not implemented. |

## A10: viewers, PWA and push, docs twins, settings sync (9 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-435 | unblock-21 | File viewer: Markdown+Mermaid, CSV/XLSX sortable tables, sandboxed HTML, images, PDF, video/audio, 3D/CAD/G-code; Source toggle; 2 MB text cap | viewer classification/CSV/source-cap foundations exist, but XLSX/PDF/media/3D/CAD/G-code renderers are not implemented. |
| CAPY-440 | unblock-22 | Phone browser + Home Screen PWA push | phone browser/PWA push is not implemented app-wide. |
| CAPY-441 | unblock-22 | Native iOS app (TestFlight beta) | native iOS replacement responsive/PWA shell is not implemented app-wide. |
| CAPY-442 | unblock-22 | Docs site with Markdown twins (.md / ?format=md / Accept header) | Markdown twin helpers exist but no docs site serves them. |
| CAPY-449 | unblock-22 | Browser push per device (mentions, failures) even with Capy closed | Blocked: subscription storage exists, but signed Web Push/VAPID delivery while the browser is closed is not implemented. |
| CAPY-504 | unblock-21 | Word documents render as pages; Markdown rendered diff with word-level changes | word-level diff exists but Word document page rendering is not implemented. |
| CAPY-505 | unblock-21 | Audio mode with per-track waveforms and Levels | waveform calculation exists but multi-track audio mode is not implemented. |
| CAPY-507 | unblock-21 | Annotate 3D models with pinned notes | pinned-note validation exists but no 3D renderer surface exists. |
| CAPY-511 | unblock-22 | Theme follows you across devices; project logo upload | local theme persistence exists but cross-device sync needs server settings outside scope. |

## B1: headless runner and device plane on a fake device (21 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-051 | unblock-36 | Background file transfers between any two machines | Only `rsyncArgv` (rsync over ssh, BatchMode) through the background-job path is tested with a fake executor. Blocked: needs a BYOM machine with SSH (later unit). |
| CAPY-061 | unblock-34 | Subagent on a named paired device while parent stays in cloud | No paired-device machine driver on `flotilla/p1`; needs the BYOM/device-pairing unit to add a placement target. |
| CAPY-091 | unblock-34 | Captain runs in cloud by default and sleeps between turns; can run on a paired device | Captains default to pool placement, but paired-device Captain execution is unavailable because no paired-device plane exists. |
| CAPY-092 | unblock-34 | 'Crew runs on' setting: cloud or one paired device; name a machine per thread | Pool placement and per-thread machine-name metadata exist, but cloud-vs-device selection fails closed because paired devices are unavailable. |
| CAPY-228 | unblock-33 | Sign in with Google, GitHub or email; computer pairs as a device | Pairing-code claim, device bearer tokens, approval and revocation are proven, but Google/GitHub sign-in and a real flotilla-runner desktop pairing flow are absent. |
| CAPY-232 | unblock-34 | No machine-time charge for local threads | Paired devices carry machineMetering=none metadata, but runner execution/billing does not yet place or meter threads on devices. |
| CAPY-233 | unblock-34 | Follow/reply to local threads from any browser incl. phone | The self-hosted API is central, but local threads cannot execute on paired devices yet, so browser follow/reply of a real local thread is unproven. |
| CAPY-234 | unblock-35 | Local thread waits while device asleep/offline up to 24 h | Device status and a 24 h wait-until timestamp are durable, but runner placement does not yet wait for device reconnect. |
| CAPY-235 | unblock-35 | Cloud checkpoints of uncommitted local work (on by default, can turn off) | The cloud-checkpoints setting is durable, but checkpoint capture/upload of device worktrees is not implemented. |
| CAPY-236 | unblock-35 | Automatic move to cloud when offline device blocks work (toggle) | The move-to-cloud toggle is durable, but offline automatic migration is not implemented. |
| CAPY-240 | unblock-35 | Keep awake while agents are running (device setting; Mac lid closed, on power) | The keep-awake setting is durable, but no flotilla-runner power-management enforcement exists yet. |
| CAPY-244 | unblock-34 | Agent runs as you with your git identity; linked folder is not a sandbox | Placement records container isolation and a git identity shape, but the runner does not yet execute on the paired device as the user or prove linked-folder sandboxing. |
| CAPY-245 | unblock-35 | Import local Claude Code and Codex histories as threads | History import accepts explicit local-only requests but does not parse Claude Code/Codex histories or create threads. |
| CAPY-246 | unblock-34 | Free models on This Mac with no plan | No free-model execution policy exists for This Mac/no-plan device runs. |
| CAPY-250 | unblock-33 | capy dock: headless device for Linux/macOS/Windows (servers, VMs, spare Macs) | Headless runner pairing/execution is not wired; this slice proves only local install, verification, directory and command semantics. |
| CAPY-251 | unblock-36 | Installer: curl\|sh (Linux/macOS) and irm\|iex (Windows); refuses root/admin | No curl-shell or PowerShell installer distribution path exists yet; root/admin refusal is proven in installer option validation only. |
| CAPY-255 | unblock-33 | Pairing via link/QR/code approved in Settings → Devices; interactive first run | QR/link/code interactive first-run approval is not connected to the CLI. |
| CAPY-257 | unblock-33 | Runs in foreground; keep alive with tmux/systemd/launchd | Foreground supervision and tmux/systemd/launchd integration are not implemented. |
| CAPY-260 | unblock-33 | Revoke device; next run re-pairs | Revocation is detected, but the next foreground run does not yet automatically re-pair. |
| CAPY-277 | unblock-36 | Local threads get a copy in ~/.capy/drive/; no background sync | `GET /threads/:id/drive/copy` returns a point-in-time tar (`x-flotilla-drive-sync: none`) and later edits are not reflected (drive-core.test.ts); nothing unpacks it into `~/.flotilla/drive` on a local machine yet; needs the BYOM machine unit. |
| CAPY-490 | unblock-34 | Thread rows show cloud vs paired device; thread waits for device reconnect | Placement API distinguishes cloud/paired device and waiting-reconnect, but thread rows do not yet render that placement or execute the reconnect handoff. |

## B2: desktop app shell (build under xvfb; signing is C) (11 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-227 | unblock-49 | Desktop app macOS (.dmg, Apple Silicon/Intel), Windows x64, Linux x64/arm64 (.deb, AppImage, .tar.gz); self-updates | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-237 | unblock-50 | Continue on / Move to a device / Return to your device (cloud↔device↔device via cloud) | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-238 | unblock-50 | What moves (branch, commits, staged/unstaged/untracked, workspace files) vs stays (.gitignored, >2 MB untracked, processes) | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-239 | unblock-50 | Move refused while repo mid-merge/rebase or other threads on machine | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-241 | unblock-49 | System tray keeps device online on Windows/Linux | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-242 | unblock-50 | Device access: Personal (approve each request) / Shared (team + org API keys); Agent access Always allow | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-243 | unblock-50 | Admins see, rename, revoke every paired device | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-247 | unblock-49 | Desktop: tabs, multiple windows, split panes | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-248 | unblock-49 | Desktop logs stay local; Export logs on crash screen | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-489 | unblock-49 | Open files in: choose editor or system default | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |
| CAPY-491 | unblock-49 | Dock/taskbar unread mentions count | Blocked: the desktop application shell, OS packaging/updater, tray integration, multi-window UI, and device transfer runtime are not implemented. |

## B3: thread image tools, desktop stream, fs transfer (7 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-200 | unblock-38 | XFCE desktop with Chrome streamed to thread pane | Blocked: the machine driver does not provide streamed GUI desktops, nested Docker/Kubernetes, or cross-machine filesystem transfer workflows. |
| CAPY-206 | unblock-37 | Preinstalled toolchain (Node/Python/Go/Rust/Java/Ruby, Docker, k8s tools, DB clients, gh stack…) | Thread image has Node 22, Python 3, git and the pinned claude/codex CLIs only. Blocked: Go/Rust/Java/Ruby, Docker, Kubernetes tools, DB clients and GitHub CLI are not installed (large image work; no Docker-in-container under `--cap-drop ALL`). |
| CAPY-207 | unblock-37 | Auto Node version from .nvmrc/.node-version | `nodeVersionFrom` picks `.node-version` then `.nvmrc` (numeric only) and boot exports it as `FLOTILLA_NODE_VERSION` to setup/startup scripts: `machine-core.test.ts`. Blocked: the image has only Node 22 and no version manager, so nothing switches the binary. |
| CAPY-208 | unblock-37 | Docker + Compose inside VM; local Kubernetes (Kind/Minikube/k3s) with caveats | Blocked: the machine driver does not provide streamed GUI desktops, nested Docker/Kubernetes, or cross-machine filesystem transfer workflows. |
| CAPY-215 | unblock-38 | Shell/desktop via + menu, no SSH | `/machine` + menu exposes a web shell with no SSH and the desktop action fails closed with 409. Blocked: pool machines do not run a desktop server yet, so the desktop half of the row is unavailable: `machine-ux.test.ts`, web `machine-core.test.tsx`. |
| CAPY-216 | unblock-38 | Machines don't share filesystems; ask to transfer files | Blocked: the machine driver does not provide streamed GUI desktops, nested Docker/Kubernetes, or cross-machine filesystem transfer workflows. |
| CAPY-436 | unblock-38 | In-app browser (Cmd/Ctrl+Shift+L) and machine Desktop tab | no in-app browser or machine Desktop stream integration exists. |

## B4: Slack connector against a local Slack API mock (16 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-029 | unblock-41 | Mermaid diagrams rendered in chat (and posted to Slack as images) | inline Mermaid flowchart fixture exists, but Slack image posting is not implemented. |
| CAPY-093 | unblock-40 | Steer a Captain from Slack with captain=<name\|alias\|code>, !queue/!steer | Command parser recognizes captain= and !queue/!steer, but Slack inbound command delivery does not exist. |
| CAPY-406 | unblock-39 | Install Slack app from Capy settings; org-wide; default project for DMs/channels | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-407 | unblock-39 | @Capy starts/continues a thread and replies in the Slack thread | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-408 | unblock-40 | Thread controls: help, aside/!aside, mute/unmute, archive, stop, unlink, !web | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-409 | unblock-39 | Channel → project mappings | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-410 | unblock-40 | Directives project/folder/channel/title/model/reasoning/machine/captain | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-411 | unblock-40 | Bang flags !new !web !fast !pro !standard !<effort> !queue !steer | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-412 | unblock-41 | Personal Slack link; Read Slack as you (read-only) | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-413 | unblock-42 | PR cards kept live from GitHub; merge from card turns on auto-merge | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-414 | unblock-41 | Agent Slack tools: read, send (with files), react, list channels, DM you, wait for reactions, edit/delete own messages | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-415 | unblock-39 | Aside prefix setting | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-452 | unblock-42 | Slack DM from Capy; PR merge/close follow-up sentence | Blocked: deterministic PR follow-up copy exists, but Slack DM delivery needs the missing Slack vendor integration. |
| CAPY-515 | unblock-39 | Admins can turn off Link to Capy thread and Post confirmations | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-516 | unblock-41 | Read Slack as you can read a DM/private channel after per-thread allow | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |
| CAPY-517 | unblock-42 | Slack DM when a thread's PR merges | Blocked: the Slack app connector, event ingestion, thread synchronisation, agent Slack tools, user-read mode, and PR card/DM surfaces are not implemented. |

## B5: Linear connector against a local mock (7 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-416 | unblock-43 | Linear connection (one workspace per org); personal account link | Blocked: the Linear connector, native agent sessions, routing maps, progress sync, and stop-signal webhook handling are not implemented. |
| CAPY-417 | unblock-43 | Delegate issue → native agent session 1:1 with a thread | Blocked: the Linear connector, native agent sessions, routing maps, progress sync, and stop-signal webhook handling are not implemented. |
| CAPY-418 | unblock-43 | Deterministic project routing; team→project map; default project | Blocked: the Linear connector, native agent sessions, routing maps, progress sync, and stop-signal webhook handling are not implemented. |
| CAPY-419 | unblock-43 | Per-repo default branches for Linear-origin threads | Blocked: the Linear connector, native agent sessions, routing maps, progress sync, and stop-signal webhook handling are not implemented. |
| CAPY-420 | unblock-44 | Posts progress, plan, responses, thread link into the session | Blocked: the Linear connector, native agent sessions, routing maps, progress sync, and stop-signal webhook handling are not implemented. |
| CAPY-421 | unblock-44 | Linear stop signal interrupts the run | Blocked: the Linear connector, native agent sessions, routing maps, progress sync, and stop-signal webhook handling are not implemented. |
| CAPY-494 | unblock-44 | captain= in a Linear mention routes the ask to that Captain | captain= Linear mention parsing exists, but Linear mention ingestion/routing does not exist. |

## B6: automation vendor triggers and run-as principal (6 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-156 | unblock-47 | Slack trigger: channel messages grouped into bursts (window 1–300 s, 20 msgs, 100 KB) | Blocked: durable automations exist, but vendor inbound triggers, Slack posting behavior, and run-as-principal enforcement connectors are not implemented. |
| CAPY-157 | unblock-47 | Slack reaction trigger | Blocked: durable automations exist, but vendor inbound triggers, Slack posting behavior, and run-as-principal enforcement connectors are not implemented. |
| CAPY-158 | unblock-47 | Linear triggers: issue created, status changed, cycle ended; team/label filters | Blocked: durable automations exist, but vendor inbound triggers, Slack posting behavior, and run-as-principal enforcement connectors are not implemented. |
| CAPY-167 | unblock-48 | Run-as principal (person or service user), re-verified every run; disabled visibly on offboarding | Blocked: durable automations exist, but vendor inbound triggers, Slack posting behavior, and run-as-principal enforcement connectors are not implemented. |
| CAPY-168 | unblock-48 | Any project member can run any automation | Blocked: durable automations exist, but vendor inbound triggers, Slack posting behavior, and run-as-principal enforcement connectors are not implemented. |
| CAPY-174 | unblock-47 | Quiet Slack posts; Matching pattern for Slack/webhook triggers; editable description | Blocked: durable automations exist, but vendor inbound triggers, Slack posting behavior, and run-as-principal enforcement connectors are not implemented. |

## B7: gemini fake CLI, plugin verification, GPG, dependency reader, vendor connectors against mocks (8 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-031 | unblock-23 | Video/audio understanding on Gemini models | no Gemini adapter or adapter-contract video/audio capability exists. |
| CAPY-312 | unblock-23 | Plugins = MCP servers + skills; marketplace 'Verified by Capy' | Blocked: plugins already combine MCP servers and skills, but the hosted public marketplace verification service implied by the row does not exist in the self-hosted build. |
| CAPY-402 | unblock-24 | Commit email; signed commits with Capy-managed GPG key | Commit email is stored/validated, but Flotilla has no managed GPG key or signed-commit path. |
| CAPY-404 | unblock-24 | Dependency reader app (read-only private deps) | Installations can record dependency-reader metadata, but no read-only dependency reader GitHub App/credential flow exists. |
| CAPY-422 | unblock-25 | Vercel preview detection with best-URL ordering | Blocked: the corresponding external integration connector (Vercel, Paper, marketplace vendor, or web retrieval provider) is not implemented. |
| CAPY-424 | unblock-25 | Paper design files read/edit in threads | Blocked: the corresponding external integration connector (Vercel, Paper, marketplace vendor, or web retrieval provider) is not implemented. |
| CAPY-425 | unblock-25 | Marketplace plugins named publicly: ClickStack, Supermemory, Keiki | Blocked: the corresponding external integration connector (Vercel, Paper, marketplace vendor, or web retrieval provider) is not implemented. |
| CAPY-426 | unblock-25 | Web search/retrieval (Firecrawl, Exa) | Blocked: the corresponding external integration connector (Vercel, Paper, marketplace vendor, or web retrieval provider) is not implemented. |

## B8: SSO, passkeys, TOTP, domain verification against local test IdP and fake DNS (6 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-368 | unblock-26 | SSO: Google Workspace OAuth/SAML, Okta, Entra ID, JumpCloud, OneLogin, Keycloak, Auth0, any SAML 2.0 (and OIDC per security page) | Blocked: no OIDC/SAML SSO, DNS domain verification, passkey/TOTP two-step, or multi-email security service is implemented. |
| CAPY-369 | unblock-26 | Domain verification by DNS | Blocked: no OIDC/SAML SSO, DNS domain verification, passkey/TOTP two-step, or multi-email security service is implemented. |
| CAPY-370 | unblock-26 | Require SSO; passkeys after SSO; manage/switch provider | Blocked: no OIDC/SAML SSO, DNS domain verification, passkey/TOTP two-step, or multi-email security service is implemented. |
| CAPY-371 | unblock-27 | Two-step sign-in: authenticator app, passkey, recovery codes; on desktop | Blocked: no OIDC/SAML SSO, DNS domain verification, passkey/TOTP two-step, or multi-email security service is implemented. |
| CAPY-372 | unblock-27 | Org two-step levels incl. Passkeys only | Blocked: no OIDC/SAML SSO, DNS domain verification, passkey/TOTP two-step, or multi-email security service is implemented. |
| CAPY-514 | unblock-27 | Name/rename passkeys; Security page shows sign-in method; multiple account emails, change primary | Blocked: no OIDC/SAML SSO, DNS domain verification, passkey/TOTP two-step, or multi-email security service is implemented. |

## B9: OIDC issuer and workload identity federation against fakes (8 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-390 | unblock-28 | Capy as OIDC issuer per org; issuer URLs in Settings → Cloud credentials | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |
| CAPY-391 | unblock-29 | AWS AssumeRoleWithWebIdentity setup + checks | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |
| CAPY-392 | unblock-29 | Azure federated identity credential | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |
| CAPY-393 | unblock-29 | Google Cloud Workload Identity Federation + SA impersonation | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |
| CAPY-394 | unblock-29 | HashiCorp Vault JWT auth | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |
| CAPY-395 | unblock-28 | Generic OIDC for any service | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |
| CAPY-396 | unblock-28 | Token claims name org/project/thread; audit logs show thread code | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |
| CAPY-397 | unblock-28 | Tokens/files at /etc/capy/cloud-access/, 1 h lifetime, refresh; remove project to revoke | Blocked: Flotilla does not implement an OIDC issuer, cloud workload identity federation, Vault JWT auth, token-file issuance, or cloud-access revocation service. |

## B10: cloud-phone provider interface and fake provider (11 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-261 | unblock-45 | Attach iOS/Android cloud phones to a thread (Revyl); screen only | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-262 | unblock-45 | Revyl auto-connects on first use; admin approval if user already has Revyl | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-263 | unblock-45 | Admins disconnect / toggle Mobile builds and devices | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-264 | unblock-45 | Device models (iPhone 18 Pro Max…iPad Pro, Pixel 7) | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-265 | unblock-46 | Mobile builds on Revyl runners (Expo/RN, native iOS, native Android) with build row in chat | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-266 | unblock-46 | Build limits: queue cancel after 2 h, one infra retry | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-267 | unblock-46 | iOS runner spec (macOS 26.6.2, Xcode 27.0…) | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-268 | unblock-46 | Watch/use phone live; Home/Back/Rotate/Open URL toolbar | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-269 | unblock-46 | Sessions ≤60 min; sleep keeps build, not app data; shared slots; 'Waiting for a phone' | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-270 | unblock-46 | Read app logs (logcat; iOS os_log/NSLog) | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |
| CAPY-271 | unblock-45 | Phone pricing iPhone $5.40/h, Android $3.60/h; Pro+ | Blocked: no pluggable iOS/Android cloud-phone provider, mobile build runner, device-control bridge, log capture, or pricing meter exists. |

## B11: dictation, advanced PR flows, visual-check runner (7 rows)

| Row | Unit | Capy behavior | Cause (from PARITY.md) |
|---|---|---|---|
| CAPY-011 | unblock-30 | Dictation (mic) into the composer, auto-accept at 10 min, Undo | Blocked: no local/user-configured speech-to-text provider integration or composer microphone lifecycle exists; implementing it requires a browser/device verification surface. |
| CAPY-116 | unblock-31 | Force merge using your GitHub bypass permission | Blocked: this requires live GitHub/desktop PR workspaces and a browser or mobile visual-check runner that Flotilla does not yet have. |
| CAPY-121 | unblock-31 | Stacked PRs (GitHub native stacks or base-branch stacks), stack chip 2/3, merge from bottom | Blocked: this requires live GitHub/desktop PR workspaces and a browser or mobile visual-check runner that Flotilla does not yet have. |
| CAPY-122 | unblock-31 | Fork PRs: check out and review; push own branch instead | Blocked: this requires live GitHub/desktop PR workspaces and a browser or mobile visual-check runner that Flotilla does not yet have. |
| CAPY-124 | unblock-31 | Labels row to edit GitHub labels; Preview chip reads Vercel, Cloudflare and other deploy comments | Blocked: this requires live GitHub/desktop PR workspaces and a browser or mobile visual-check runner that Flotilla does not yet have. |
| CAPY-127 | unblock-31 | Local PRs on desktop: Diff tab, mark ready/draft, close, reopen, merge | Blocked: this requires live GitHub/desktop PR workspaces and a browser or mobile visual-check runner that Flotilla does not yet have. |
| CAPY-147 | unblock-32 | Visual check: run app, click through, attach screenshots/video to PR; mobile via cloud phone | Blocked: this requires live GitHub/desktop PR workspaces and a browser or mobile visual-check runner that Flotilla does not yet have. |

## C: mehdi only (24 rows, stay `needs-human-login`)

- GitHub PAT + test repo: CAPY-108, 115, 117, 118, 123, 128, 129, 145, 181, 400
- GitHub App install + public webhook URL: CAPY-398
- Claude login: CAPY-319, 321, 322, 325, 333, 484
- Codex login: CAPY-337
- Provider key: CAPY-328, 329, 330
- Catalog prices: CAPY-318
- MCP provider OAuth: CAPY-307
- Tailscale: CAPY-423

Allowed A-parts only: CAPY-333 (map the Claude/Codex usage-limit exit to `run_out` from recorded fixtures, in unblock-20) and CAPY-181 (per-member GitHub identity once org membership lands, in unblock-19). Both rows keep their status and their live command.
