# P2 exit: core parity, your machines, any agent

`flotilla/p1` head at exit preparation: `30fbbf4` (`phase2-15: device execution foundation`).

## Gate output

`make verify` result is recorded below. The compose health endpoint is the required `/healthz` `ok` response.

```text
make verify exit 0
apps/server: 46 test files passed, 256 passed, 1 skipped
docker compose up -d --build --wait completed
curl /healthz: ok (the first immediate attempt hit a transient connection reset; retry then returned ok)
```

## Demo scope

Phase 2 was exercised through the merged fake-agent and fixture suites in `make check`: durable runner queue and steer modes, model/secrets/env APIs, thread composer/lifecycle/public API, environments, snapshots, machine lifecycle/UX, device pairing/execution/dock fixtures, wakes, subagents, Captains, PR/review/automation surfaces, projects, Drive, rules, skills, MCP, GitHub integration fixtures, usage/billing and troubleshooting documentation. Live vendor/device/GitHub/Slack-like behavior remains fixture-only where marked below.

## Done rows (255)

CAPY-004, CAPY-007, CAPY-012, CAPY-015, CAPY-016, CAPY-017, CAPY-018, CAPY-019, CAPY-020, CAPY-021, CAPY-022, CAPY-023, CAPY-024, CAPY-027
CAPY-032, CAPY-033, CAPY-034, CAPY-038, CAPY-039, CAPY-040, CAPY-041, CAPY-044, CAPY-045, CAPY-047, CAPY-048, CAPY-049, CAPY-052, CAPY-053
CAPY-054, CAPY-055, CAPY-056, CAPY-057, CAPY-058, CAPY-059, CAPY-060, CAPY-068, CAPY-073, CAPY-074, CAPY-075, CAPY-080, CAPY-081, CAPY-082
CAPY-084, CAPY-085, CAPY-088, CAPY-090, CAPY-094, CAPY-096, CAPY-100, CAPY-110, CAPY-120, CAPY-125, CAPY-131, CAPY-132, CAPY-133, CAPY-135
CAPY-136, CAPY-138, CAPY-139, CAPY-140, CAPY-141, CAPY-142, CAPY-143, CAPY-144, CAPY-148, CAPY-149, CAPY-150, CAPY-152, CAPY-154, CAPY-155
CAPY-159, CAPY-160, CAPY-161, CAPY-162, CAPY-164, CAPY-165, CAPY-166, CAPY-169, CAPY-170, CAPY-173, CAPY-177, CAPY-178, CAPY-179, CAPY-180
CAPY-186, CAPY-189, CAPY-191, CAPY-192, CAPY-193, CAPY-194, CAPY-195, CAPY-196, CAPY-197, CAPY-201, CAPY-202, CAPY-203, CAPY-204, CAPY-205
CAPY-209, CAPY-210, CAPY-211, CAPY-213, CAPY-214, CAPY-218, CAPY-219, CAPY-221, CAPY-223, CAPY-224, CAPY-225, CAPY-226, CAPY-229, CAPY-230
CAPY-231, CAPY-249, CAPY-252, CAPY-253, CAPY-254, CAPY-256, CAPY-258, CAPY-259, CAPY-272, CAPY-273, CAPY-274, CAPY-275, CAPY-276, CAPY-278
CAPY-279, CAPY-280, CAPY-281, CAPY-282, CAPY-283, CAPY-284, CAPY-285, CAPY-286, CAPY-287, CAPY-288, CAPY-289, CAPY-290, CAPY-291, CAPY-292
CAPY-293, CAPY-294, CAPY-295, CAPY-296, CAPY-297, CAPY-298, CAPY-299, CAPY-300, CAPY-301, CAPY-302, CAPY-303, CAPY-305, CAPY-308, CAPY-309
CAPY-310, CAPY-311, CAPY-327, CAPY-331, CAPY-335, CAPY-336, CAPY-341, CAPY-346, CAPY-352, CAPY-353, CAPY-380, CAPY-382, CAPY-383, CAPY-384
CAPY-385, CAPY-386, CAPY-387, CAPY-388, CAPY-389, CAPY-399, CAPY-405, CAPY-453, CAPY-454, CAPY-455, CAPY-456, CAPY-457, CAPY-458, CAPY-459
CAPY-460, CAPY-461, CAPY-462, CAPY-464, CAPY-471, CAPY-472, CAPY-473, CAPY-474, CAPY-475, CAPY-477, CAPY-478, CAPY-479, CAPY-481, CAPY-488
CAPY-492, CAPY-493, CAPY-498, CAPY-499, CAPY-500, CAPY-501, CAPY-502, CAPY-503, CAPY-518, CAPY-519, CAPY-520, CAPY-521, CAPY-522, CAPY-523
CAPY-524, CAPY-525, CAPY-526, CAPY-527, CAPY-528, CAPY-529, CAPY-530, CAPY-531, CAPY-532, CAPY-533, CAPY-534, CAPY-535, CAPY-538, CAPY-539
CAPY-540, CAPY-544, CAPY-545, CAPY-546, CAPY-547, CAPY-548, CAPY-549, CAPY-550, CAPY-551, CAPY-552, CAPY-553, CAPY-554, CAPY-555, CAPY-556
CAPY-557, CAPY-558, CAPY-559, CAPY-560, CAPY-561, CAPY-593, CAPY-594, CAPY-595, CAPY-601, CAPY-603, CAPY-604, CAPY-609, CAPY-610, CAPY-635
CAPY-636, CAPY-637, CAPY-639

## Blocked rows (82)

- `CAPY-009` (phase2-05): Server/API proven in runner-queue.test.ts: PATCH/DELETE `/threads/:id/inbox/:item` edit or discard a pending message; 409 once the agent read it. Blocked: web UI (edit/discard control on queued messages) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-010` (phase2-05): Server/API proven in runner-queue.test.ts: POST `/threads/:id/inbox/:item/versions` adds version n+1 (same root) and continues from it in a new session (no adapter rewind yet). Blocked: web UI (sent-message edit and version switcher) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-026` (phase2-05): Server/API proven in runner-queue.test.ts: GET/PATCH `/threads/:id/context`: used tokens from the last run; Compact at is editable only when the adapter declares `compaction`. Blocked: web UI (context meter and Compact-at control) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-043` (phase2-17): Server proven: `wake_settings` org + personal (field-by-field), React/Keep as context/Ignore per event, `GET/PUT /wake-settings/{org,me}` (org admin-only), context items prefix the next react. Blocked: no web settings screen in budget.
- `CAPY-046` (phase2-17): Router proven with a fake executor: default 30 min, max 6 h timeout, $ cap, wake on exit/timeout, `keepAwake` flag. Blocked: no machine idle-stop consumes `keepAwake` yet (phase2-12), and production has no machine executor yet (jobs return Conflict).
- `CAPY-050` (phase2-17): Hold/allow proven: `PUT /threads/:id/hold`, held items in `wake_inbox`, owner-only allow/decline. Blocked: BYOM threads do not auto-enable hold and there is no held-messages UI (BYOM is a later unit).
- `CAPY-051` (phase2-17): Only `rsyncArgv` (rsync over ssh, BatchMode) through the background-job path is tested with a fake executor. Blocked: needs a BYOM machine with SSH (later unit).
- `CAPY-061` (phase2-18): No paired-device machine driver on `flotilla/p1`; needs the BYOM/device-pairing unit to add a placement target.
- `CAPY-062` (phase2-18): Siblings are created and messaged through the user-authenticated subagent API; no agent-callable tool for non-Captain threads exists (Captain `crew.*` MCP tools are outside this unit).
- `CAPY-063` (phase2-19): Side chat requires a same-machine full workspace/session copy and tab UX; only the subagent API vertical slice fit this unit. Blocked: no machine workspace clone/session-copy primitive or thread tab UI yet.
- `CAPY-064` (phase2-19): Fork/summary-fork requires adapter session copy for full forks plus fresh-machine workspace copy; summary-fork can use any adapter but still needs the fork lifecycle. Blocked: no fork API/workspace clone primitive yet.
- `CAPY-065` (phase2-19): Passage fork/side-chat depends on the blocked fork/side-chat primitives plus composer passage selection UI; no such selection/fork workflow exists yet.
- `CAPY-067` (phase2-20): New-Captain backend exists, but the required dialog with name/face/project/machine/model/access is not implemented in the web UI; blocked on that UI slice.
- `CAPY-069` (phase2-20): Flotilla has no folder entity/folder removal workflow, so folder promotion cannot currently move folder threads into a crew.
- `CAPY-070` (phase2-20): Natural-language “Make a Captain…” creation through an existing thread is not implemented; only direct Captain create/promote APIs exist.
- `CAPY-072` (phase2-20): Crew archive/release API exists, but Captain archive does not yet put crew machines to sleep and delete/demote lifecycle is incomplete.
- `CAPY-076` (phase2-22): Crew lifecycle events exist in the scheduler, but turn-end/need wiring into this operations surface and beside-chat UI is not connected.
- `CAPY-077` (phase2-22): No runner/crew event currently reports that a crew thread answered the user directly.
- `CAPY-078` (phase2-22): Pull-requests page has no Captain filter control; no UI integration is implemented.
- `CAPY-091` (phase2-21): Captains default to pool placement, but paired-device Captain execution is unavailable because no paired-device plane exists.
- `CAPY-092` (phase2-21): Pool placement and per-thread machine-name metadata exist, but cloud-vs-device selection fails closed because paired devices are unavailable.
- `CAPY-095` (phase2-22): Automations still create ordinary threads and cannot yet hand work to or start Captain threads.
- `CAPY-098` (phase2-22): Captains-first/hybrid sidebar with pinned faces and waiting questions is not implemented.
- `CAPY-099` (phase2-22): No chat observer starts work from a passing mention.
- `CAPY-111` (phase2-23): Org/personal draft defaults are durable, but per-PR draft changes by asking the agent are not wired.
- `CAPY-112` (phase2-23): Open-in-Flotilla preference is durable, but PR creation does not yet write the button into descriptions.
- `CAPY-113` (phase2-23): Pulls exist at /pulls, but exact /pull/<owner>/<repo>/<n> routing and Cmd+K lookup are outside the implemented slice.
- `CAPY-114` (phase2-23): Pull detail exposes chat/new-thread links, but they do not yet create a thread preloaded with PR context.
- `CAPY-126` (phase2-23): PR status exists in pull data but the thread sidebar has no extension point inside this unit scope.
- `CAPY-130` (phase2-24): Review runs are durable/read-only/head-pinned metadata, but no real machine checkout or review agent execution is wired yet.
- `CAPY-134` (phase2-24): API and source labels exist, but PR-page buttons and @mention ingestion are not connected.
- `CAPY-137` (phase2-24): Review runs record adapter/connection selection, but no policy yet prevents use of owner keys/subscriptions.
- `CAPY-151` (phase2-25): Review machine read-only enforcement and the 4 GB default are not wired to machine provisioning.
- `CAPY-153` (phase2-26): Automation API exists, but neither an Automations page nor agent-accessible full management tools are implemented.
- `CAPY-163` (phase2-26): run_when is stored and injectable for fixture proof, but production has no configurable free fast-model gate adapter wired yet.
- `CAPY-171` (phase2-27): Automation drive_scope metadata is durable, but Drive state is not yet mounted into automation runs.
- `CAPY-172` (phase2-27): Per-automation machine_size is durable, but runner machine placement does not consume it yet.
- `CAPY-175` (phase2-27): Failed automation runs and thread references are retained, but runner output/completion is not yet written back to automation_runs.output.
- `CAPY-182` (phase2-29): Proven: `visibility` is `private` by default, and private projects are hidden (404) from other users and only the owner edits or clones. Blocked: the non-private counterpart is not usable by teammates. `shared` projects are listed and readable, but `ThreadRunner.create` and Captain creation still require `projects.owner_id`, so collaborator use needs P3 org membership. Test: `apps/server/src/projects/projects.test.ts`; UI `apps/web/e2e/projects.spec.ts`.
- `CAPY-183` (phase2-10): Versioned per-project `EnvironmentSpec` (setup phases, startup entries, commands) with shared history: `environments.test.ts`, UI `apps/web/e2e/environments.spec.ts`. Blocked remainder: container snapshot (phase2-11); phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211).
- `CAPY-184` (phase2-10): `environment.verify` runs initialize on the thread machine and records the verdict on the version (local-process machine fixture). Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no "Ask to set up" button.
- `CAPY-185` (phase2-10): initialize 900 s / refresh 300 s defaults, 60-3600 s validation, timeout kill, fresh-clone vs moved-checkout `choosePhase`, proven with a local-process machine. Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no test asserts initialize/refresh selection on a pool-booted machine.
- `CAPY-187` (phase2-10): `bash -c` from `caps.repoDir` with thread env and `FLOTILLA_SUDO` from machine caps (off by default, so BYOM gets no sudo). Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: running as the sudo user is machine-image work (phase2-12).
- `CAPY-188` (phase2-10): `POST /threads/:id/environment/commands/:name` runs a named command on the registered machine and records state. Blocked: phase2-12 machine core now calls `registerEnvironmentMachine` and `EnvironmentStore.prepare` at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211). Remaining: no test runs a named command on a pool-booted machine.
- `CAPY-190` (phase2-10): `environment.read`/`environment.replace` (whole spec, validated, stale `baseVersion` refused, own project only) via `POST /threads/:id/environment/tools/:name`. Blocked: not yet in the Captain/agent tool registry; verify needs a registered machine, which phase2-12 machine core now provides at every pool-machine boot/wake (`machine-core.test.ts` CAPY-210/211).
- `CAPY-206` (phase2-12): Thread image has Node 22, Python 3, git and the pinned claude/codex CLIs only. Blocked: Go/Rust/Java/Ruby, Docker, Kubernetes tools, DB clients and GitHub CLI are not installed (large image work; no Docker-in-container under `--cap-drop ALL`).
- `CAPY-207` (phase2-12): `nodeVersionFrom` picks `.node-version` then `.nvmrc` (numeric only) and boot exports it as `FLOTILLA_NODE_VERSION` to setup/startup scripts: `machine-core.test.ts`. Blocked: the image has only Node 22 and no version manager, so nothing switches the binary.
- `CAPY-212` (phase2-12): Warns a day ahead (`machine.state` event). Deletion now fails closed: without a successful pre-delete WIP-capture hook the lease remains sleeping and the workspace volume is retained; a failed wake restores the prior lease without deleting the workspace: `machine-core.test.ts`. Blocked: production `beforeDelete` does not push WIP, so real 14-day workspace deletion/rebuild is intentionally unavailable.
- `CAPY-215` (phase2-13): `/machine` + menu exposes a web shell with no SSH and the desktop action fails closed with 409. Blocked: pool machines do not run a desktop server yet, so the desktop half of the row is unavailable: `machine-ux.test.ts`, web `machine-core.test.tsx`.
- `CAPY-228` (phase2-14): Pairing-code claim, device bearer tokens, approval and revocation are proven, but Google/GitHub sign-in and a real flotilla-runner desktop pairing flow are absent.
- `CAPY-232` (phase2-14): Paired devices carry machineMetering=none metadata, but runner execution/billing does not yet place or meter threads on devices.
- `CAPY-233` (phase2-14): The self-hosted API is central, but local threads cannot execute on paired devices yet, so browser follow/reply of a real local thread is unproven.
- `CAPY-234` (phase2-14): Device status and a 24 h wait-until timestamp are durable, but runner placement does not yet wait for device reconnect.
- `CAPY-235` (phase2-14): The cloud-checkpoints setting is durable, but checkpoint capture/upload of device worktrees is not implemented.
- `CAPY-236` (phase2-14): The move-to-cloud toggle is durable, but offline automatic migration is not implemented.
- `CAPY-240` (phase2-14): The keep-awake setting is durable, but no flotilla-runner power-management enforcement exists yet.
- `CAPY-244` (phase2-15): Placement records container isolation and a git identity shape, but the runner does not yet execute on the paired device as the user or prove linked-folder sandboxing.
- `CAPY-245` (phase2-15): History import accepts explicit local-only requests but does not parse Claude Code/Codex histories or create threads.
- `CAPY-246` (phase2-15): No free-model execution policy exists for This Mac/no-plan device runs.
- `CAPY-250` (phase2-16): Headless runner pairing/execution is not wired; this slice proves only local install, verification, directory and command semantics.
- `CAPY-251` (phase2-16): No curl-shell or PowerShell installer distribution path exists yet; root/admin refusal is proven in installer option validation only.
- `CAPY-255` (phase2-16): QR/link/code interactive first-run approval is not connected to the CLI.
- `CAPY-257` (phase2-16): Foreground supervision and tmux/systemd/launchd integration are not implemented.
- `CAPY-260` (phase2-16): Revocation is detected, but the next foreground run does not yet automatically re-pair.
- `CAPY-277` (phase2-30): `GET /threads/:id/drive/copy` returns a point-in-time tar (`x-flotilla-drive-sync: none`) and later edits are not reflected (drive-core.test.ts); nothing unpacks it into `~/.flotilla/drive` on a local machine yet; needs the BYOM machine unit.
- `CAPY-317` (phase2-34): Proposal API `POST /threads/:id/mcp/proposals` + in-thread card proven; no agent-callable tool path from the thread machine yet (same gap as environment tools).
- `CAPY-332` (phase2-03): blocked: the row is the web model picker (badges, connection tooltip, Alt+1…9 favorites) and `apps/web` is outside phase2-03 SCOPE; the server API returning badges, tooltips, favorites and shortcuts is proven (models-catalog.test.ts). Needs a web picker unit.
- `CAPY-338` (phase2-04): `POST /api/v1/models/background` resolves the user's policy `background` model, else the thread's own, under the same policy and connections (no hosted account) — proven. Blocked: phase2-07's `TitleGenerator` is the offline heuristic and no PR-summary generator exists; a model-backed generator that runs on this resolver's selection is still needed (owner: the unit adding model-generated titles/PR summaries).
- `CAPY-401` (phase2-35): Account-level and per-PR commit identity settings validate all four options, but commit/PR creation does not consume them yet.
- `CAPY-402` (phase2-35): Commit email is stored/validated, but Flotilla has no managed GPG key or signed-commit path.
- `CAPY-403` (phase2-35): Generic PR comment wakes exist, but `@capy` command parsing and the eyes reaction are not implemented.
- `CAPY-404` (phase2-35): Installations can record dependency-reader metadata, but no read-only dependency reader GitHub App/credential flow exists.
- `CAPY-465` (phase2-05): Server/API proven in runner-queue.test.ts: `/plan` prefixes PLAN_PROMPT, opens a blocking `gate='plan'` approval, skips after-run hooks and holds the inbox until approved. Blocked: web UI (/plan composer command and plan-approval card) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-466` (phase2-05): Server/API proven in runner-queue.test.ts: `/btw <q>` creates a child thread (`parent_id`) and emits `thread.side` on the parent. Blocked: web UI (/btw side-thread panel) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-467` (phase2-05): Server/API proven in runner-queue.test.ts: Messages with un-uploaded owned files wait as `waiting_upload` and are released by `resumePending()` (also after restart). Blocked: web UI (pending-upload indicator on the composer) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-468` (phase2-05): Server/API proven in runner-queue.test.ts: GET `/threads/:id/inbox` returns `queuedCount` and `folded` (>=2). Blocked: web UI (folded queue count) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-469` (phase2-05): Server/API proven in runner-queue.test.ts: Adapter errors are classified (`runs.error`, `run.ended.error`); POST `/threads/:id/retry` re-sends the last message, optionally with another model/connection. Blocked: web UI (retry/error card with model switch) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-470` (phase2-05): Server/API proven in runner-queue.test.ts: POST `/approvals/:id/later` (snooze) and `/dismiss`, POST `/captains/:id/approvals/dismiss`; each emits `approval.updated`. Blocked: web UI (request cards with Later/Dismiss and Captain dismiss-all) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-476` (phase2-05): Server/API proven in runner-queue.test.ts: Nested tool calls/results keep `parentId` in live `agent.tool_*` events. Blocked: web UI (nested codemode tool-call display) not built in phase2-05 (server-only slice within diff budget); needs a web unit.
- `CAPY-485` (phase2-04): Proven offline: PATCH `/api/v1/connections/:id` `{baseUrl}` (http/https only) reaches the next run as `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` (manifest `baseUrlEnvVar`). Blocked: no web connections editor yet (same web unit as CAPY-332). Live gateway: `ANTHROPIC_BASE_URL=<gateway> claude -p ok --bare` with the operator's key, unverified.
- `CAPY-490` (phase2-15): Placement API distinguishes cloud/paired device and waiting-reconnect, but thread rows do not yet render that placement or execute the reconnect handoff.
- `CAPY-495` (phase2-22): Large crew/subagent lists are not virtualized.

## Needs human login (16)

- `CAPY-115` (phase2-23): Fixture gateway proves merge methods/comment/update/auto-merge and blocked reasons; live GitHub mutation still requires a connected account.
- `CAPY-117` (phase2-23): Fixture gateway receives the connected-login actor vs flotilla fallback; live posting identity needs GitHub verification.
- `CAPY-123` (phase2-23): Fixture gateway proves summary/comment/request-changes/approve actor selection; live review submission needs GitHub verification.
- `CAPY-145` (phase2-25): The optional capy/review commit-status setting is durable, but live GitHub status writeback requires a real GitHub login.
- `CAPY-181` (phase2-29): Sources `github
- `CAPY-307` (phase2-34): BYO client id/secret + PKCE + redirect `${FLOTILLA_PUBLIC_URL}/api/v1/mcp/oauth/callback` proven against a local token fixture; real provider sign-in needs a login (runlog).
- `CAPY-318` (phase2-03): catalog rows (adapter+model, list price, BYOK, ZDR) proven with built-in free + operator fixture file; real vendor rows/prices: operator fills FLOTILLA_MODEL_CATALOG.
- `CAPY-325` (phase2-03): none…max validated per catalog model, unsupported fails with no fallback, effort reaches StartInput (fake); CLI effort-flag mapping unverified with real claude/codex.
- `CAPY-328` (phase2-03): provider list from adapter auth capabilities, searchable; subscription = CLI vendor/device login; real logins and gateway list need mehdi.
- `CAPY-329` (phase2-03): check access via local OpenAI-compatible fixture; exclusions; new models auto-covered; real provider endpoints need a key.
- `CAPY-330` (phase2-03): custom model ids added/found/selectable on a connection (fixture); real key needed for live endpoint.
- `CAPY-333` (phase2-04): Proven offline (model-policy-api.test.ts, web model-policy-api.test.tsx): per-user `runOut` ask (default, pause-and-ask) / ask-before-free / keep-going; a `run_out` run opens a Wait/Use <next connection> card, `/wait` and `/continue` typed into the thread answer it, Use reruns the prompt on the next connection. Live: the Claude Code/Codex adapters do not yet map a vendor usage-limit exit to `run_out`; operator check: `claude auth login` then run a thread until the subscription limit, and `codex login` likewise, and record the CLI's final event.
- `CAPY-337` (phase2-04): Catalog `contextWindow` is listed, carried on the thread engine and passed to Codex as `-c model_context_window=1050000` (argv proven with a fixture GPT-6 row). Live: `codex login && codex exec --json --model gpt-6 -c model_context_window=1050000 'say ok'` with a real GPT-6 catalog row (model id/window unverified).
- `CAPY-400` (phase2-35): Personal-account API shape and acting identity settings exist, but live OAuth/PAT verification and acting as the user on GitHub need a human login. Operator command: connect a PAT/OAuth token, then run a fixture PR creation against a test repository.
- `CAPY-423` (phase2-15): Fixture validation covers tagged ephemeral nodes, ACL shape, vault/secret OAuth references and disconnect state. Operator verification: set a real Tailscale OAuth client in the vault, put /api/v1/devices/:id/tailscale, then verify the tagged ephemeral node appears and disappears on disconnect.
- `CAPY-484` (phase2-04): Proven offline: one list row per Claude model; a connected Claude subscription is first in run order (before an API key added earlier) and resolve picks it; production `defaultRunner` now registers the claude-code and codex adapters. Live: `claude auth login`, connect the subscription, run a thread on a Claude model and confirm it runs without ANTHROPIC_API_KEY.

## Not proven

No paid vendor calls, real vendor logins, live Slack/Linear/GitHub webhook traffic, real paired macOS/Windows devices, or real Tailscale enrollment were used. Those rows are either `blocked` or `needs-human-login` above; `done` rows are backed by merged fake-agent or fixture tests only.

## Ledger correction

`CAPY-177`, `CAPY-178` and `CAPY-179` were missing from `PARITY.md` even though their phase2-29 tests were merged; this exit PR restores those rows as `done` with links to PR #42.
