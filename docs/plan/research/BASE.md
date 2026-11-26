# BASE.md: choosing Flotilla's base (step 3)

Written Nov 27, 2026 (PKT). Inputs: `BOT-BRIEF.md`, `research/CAPY.md` (step 1), `research/FIRSTMATE.md` (step 2), the T3 Code source at `research/t3code/` (shallow clone, HEAD `d6061ec`, committed 2026-11-26 10:31 -0800 = 23:31 PKT), GitHub API and npm registry lookups, and the vendors' own CLI docs. Nothing was installed, nothing was pushed.

## How to read this

- **[M] measured**: I read it in the cited file or fetched it today. For vendor docs, "measured" means "the vendor's docs say this". I did not run the CLIs.
- **[I] inferred**: my conclusion from measured facts. All scores and the recommendation are [I].
- **[G] guess**: plausible, thin evidence. Effort numbers are guesses.
- `t3:path:line` = `research/t3code/path:line`. `fm:path:line` = `research/firstmate/path:line`. `CAPY.md §n` / `FIRSTMATE.md §n` = earlier steps.
- `GH-API <owner/repo>` = `https://api.github.com/repos/<owner/repo>`, fetched Nov 27, 2026 (PKT), field `license.spdx_id`.

---

## 0. The short version

Plain words: don't fork either project. Write a small new TypeScript server that owns the loop, the budgets and the safety rules, and borrow the best ideas (and some MIT code) from both. firstmate gives us the "only wake the human when it matters" rules and the per-agent cheat sheets. T3 Code gives us proven patterns for driving agent CLIs, linking remote machines and storing events. Both are MIT, so we can copy with credit.

**Recommendation (one line):** option (c) from scratch as a hybrid: a new TypeScript (Node 22) server on Postgres (pg-boss from P2), one Docker container per thread, an outbound-dialing `flotilla-runner` for BYO machines over Tailscale or SSH, with firstmate's triage rules and harness facts ported into typed code and T3 Code used as an MIT reference (selected small modules copied with attribution, no fork). [I]

Why, in three lines [I]:
1. Both bases miss the three things mehdi made hard requirements: a code kernel (not prompts) for safety, runtime-enforced $/token caps, and container or dedicated-user isolation. Retrofitting them into 148k lines of bash (firstmate) or ~1.08M lines of Effect-TS (T3 Code) is more work than writing a small core.
2. Each is a single-user, local-first tool. Flotilla is a self-hosted multi-machine server with Captains, automations and an API. The core shapes differ.
3. Both are MIT, so "from scratch" doesn't mean "from nothing": we port the parts that took them months to learn.

---

## 1. Carry-in 1: licenses of firstmate's dependencies

firstmate's required tools are `node, git, gh, no-mistakes ≥1.46.0, gh-axi, chrome-devtools-axi, tasks-axi, quota-axi`, plus `treehouse` for most backends and `lavish-axi` as a presentation-only extra [M] fm:docs/configuration.md:2438-2448, fm:bin/fm-bootstrap.sh:921. The axi tools install with `npm install -g <name>` [M] fm:bin/fm-bootstrap.sh:877-878. treehouse and no-mistakes link to `github.com/kunchenguid/...` [M] (rg across the firstmate tree).

| Tool | Repo | License | Lang | Label + source |
|---|---|---|---|---|
| treehouse (worktrees) | kunchenguid/treehouse | MIT | Go | [M] GH-API kunchenguid/treehouse |
| no-mistakes (validation pipeline) | kunchenguid/no-mistakes | MIT | Go | [M] GH-API kunchenguid/no-mistakes |
| gh-axi (GitHub ops) | kunchenguid/gh-axi | MIT | TypeScript | [M] GH-API; npm `gh-axi@0.1.52` license MIT, repo kunchenguid/gh-axi |
| tasks-axi (backlog) | kunchenguid/tasks-axi | MIT | TypeScript | [M] GH-API; npm `tasks-axi@0.2.6` MIT |
| quota-axi (subscription quota windows) | kunchenguid/quota-axi | MIT | TypeScript | [M] GH-API; npm `quota-axi@0.1.69` MIT |
| chrome-devtools-axi (browser) | kunchenguid/chrome-devtools-axi | MIT | TypeScript | [M] GH-API; npm `chrome-devtools-axi@0.1.46` MIT |
| lavish-axi (visual reports, optional) | kunchenguid/lavish-axi | MIT | JavaScript | [M] GH-API; npm `lavish-axi@0.1.99` MIT |
| gh (GitHub CLI) | cli/cli | MIT | Go | not re-checked today; widely known as MIT, so **unverified** here |

**Trap:** the npm packages named `no-mistakes` and `treehouse` are *other people's projects* (npm `no-mistakes` → jonathanong/no-mistakes, MIT; npm `treehouse` → markevans/treehouse, ISC) [M] https://registry.npmjs.org/no-mistakes/latest, https://registry.npmjs.org/treehouse/latest. firstmate's ones are the Go repos under kunchenguid. Never `npm install` those names expecting firstmate's tools [I].

**Verdict:** everything in firstmate's toolchain we'd reuse is MIT. No AGPL. Keep the MIT notices in `THIRD_PARTY_NOTICES.md` [I].

---

## 2. Carry-in 2: which agent CLIs run headless with JSON output

This decides whether Flotilla can drive agents from inside a container without scraping a terminal (firstmate's "standing debt", FIRSTMATE.md §13.4).

| Agent | Headless? | How (official docs) | Resume / cancel | Cost and limits it reports | Label + source |
|---|---|---|---|---|---|
| **Claude Code** | Yes | `claude -p "<prompt>" --output-format stream-json --verbose` (also `json`, `--input-format stream-json` for multi-turn on stdin). `--bare` skips auto-loaded hooks, skills, plugins, MCP and CLAUDE.md; without it a `-p` run executes the project's `.claude/settings.json` hooks and `.mcp.json` servers "even in a folder you've never trusted" | `--resume <session-id>` / `--continue`; cancel = signal the process | `json` result includes `total_cost_usd` and a per-model breakdown (client-side estimate). `--max-budget-usd` cap exists | [M] https://code.claude.com/docs/en/headless (fetched today) |
| **Codex CLI** | Yes | `codex exec --json "<prompt>"` → JSONL event stream on stdout. Also `codex app-server`: JSON-RPC 2.0 over stdio JSONL (default), websocket (experimental) or unix socket | `codex exec resume <SESSION_ID>` / `--last` | token usage in events [I from event stream; field names not re-read] | [M] https://developers.openai.com/codex/noninteractive, https://developers.openai.com/codex/app-server |
| **Cursor CLI** | Yes | `agent -p --output-format stream-json [--stream-partial-output]`. Without `--force`, anything needing approval is rejected; `--force`/`--yolo` runs everything except `permissions.deny` and team policy | `--resume <id>` (brief) | not checked | [M] https://cursor.com/docs/cli/headless; `--resume` from BOT-BRIEF.md "Known so far" |
| **Gemini CLI** | Yes | `gemini -p "<prompt>" --output-format stream-json` → JSONL events `init, message, tool_use, tool_result, error, result` (result has per-model token usage). Exit codes 0/1/42/53 (53 = turn limit) | `gemini --acp` for session-based control | per-model token usage in `result` | [M] https://geminicli.com/docs/cli/headless/ (page last updated Mar 10, 2026) |
| **Devin** | Yes, but remote | Cloud: REST v3 `POST /v3/organizations/{org}/sessions` (body includes `max_acu_limit`, `repos`, `secret_ids`, `resumable`) and `.../messages`. Devin runs on its own VMs, not in our container. CLI: `devin --cloud -p "<prompt>"`, resume `devin --cloud -r <url>`; local `devin -p` | resume via session URL / messages API | `max_acu_limit` per session (ACUs, not $) | [M] https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions; CLI from DEVIN-PLAYBOOK.md §4B [V S21 = https://docs.devin.ai/cli/cloud.md]. Devin CLI JSON output format: **unverified** |
| **ACP (any agent)** | Yes (protocol) | JSON-RPC over stdio: `initialize`, `session/new`, `session/load` (resume, if supported), `session/prompt`, notifications `session/update`, `session/cancel`, `session/set_mode`; agent asks the client for file ops and permissions | `session/load`, `session/cancel` | none defined in the parts I read | [M] https://agentclientprotocol.com/protocol/overview. Spec repo agentclientprotocol/agent-client-protocol is Apache-2.0 [M] GH-API. Claude via adapter: agentclientprotocol/claude-agent-acp (Apache-2.0) [M] GH-API |

What this means for Flotilla [I]:
- All five named agents have a structured mode. So the adapter interface can be event-stream based (JSONL / JSON-RPC), with "generic CLI + PTY" only as the last-resort adapter.
- Claude Code's `--bare` matters for security: a thread working on an untrusted PR repo would otherwise run that repo's hooks and MCP servers. The Claude adapter should default to `--bare` plus explicit `--settings`/`--mcp-config` from Flotilla [I].
- Claude's `--max-budget-usd` and Devin's `max_acu_limit` are *vendor-side* caps. Use them as a second fence, never as the kernel's cap: the kernel must enforce Flotilla's own cap for agents that have none (Codex, Cursor, Gemini, ACP) [I].
- Cost data: Claude reports `total_cost_usd`; Gemini reports tokens; others vary. Per-thread cost tracking = vendor $ when given, else tokens × a user-editable price table, labelled "estimate" in the UI [I].

---

## 3. Carry-in 3: T3 Code, license, architecture, telemetry, fit

| Item | Finding | Label + source |
|---|---|---|
| License | MIT, "Copyright (c) 2026 T3 Tools Inc." Also on `apps/server/package.json` (`"license": "MIT"`) | [M] t3:LICENSE:1-3, t3:apps/server/package.json:4, GH-API pingdotgg/t3code `MIT` |
| Trademark | MIT covers code only. Forks must replace the name, wordmark, logos and icons and say they're unofficial | [M] t3:README.md:110-119, t3:TRADEMARK.md:19-25 |
| Popularity | 80,720 stars; pushed 2026-11-26 19:04 UTC (Nov 27 00:04 PKT) | [M] GH-API |
| What it is | "A Node WebSocket server wraps provider CLIs and agents … and serves web, desktop, and mobile clients." A bring-your-own-subscription alternative to Claude Desktop / Codex App / Conductor | [M] t3:AGENTS.md:3-5 |
| Stack | TypeScript, Effect-TS throughout, Node ^22.16; SQLite persistence; Electron desktop; React Native mobile; Vite web | [M] t3:apps/server/package.json:67 (effect), :105 (node engines), t3:apps/server/src/persistence/Sqlite.ts, t3:AGENTS.md:25-31 |
| Size | ~341k lines non-test TS in `apps/server/src`, ~366k in `apps/web/src`, ~376k in `packages/` | [M] `git ls-files … \| wc -l` today |
| Orchestration core | Event-sourced: the orchestrator decides events without I/O; `EventSink` commits events + projections + command receipts + outbox effects in one DB transaction; an effect worker runs side effects after commit. Event log keeps only a bounded replay window | [M] t3:docs/internals/01_architecture.md:30-47 |
| Checkpoints | Hidden Git refs so snapshots never add commits to the user's branch | [M] t3:docs/internals/01_architecture.md:60-62 |
| Provider adapters | `ProviderAdapterV2` at `packages/provider-core/src/server/ProviderAdapter.ts` (916 lines). Rule: "Orchestration and clients read declared capabilities, never provider names"; strict ACP for non-first-party agents; "Declare only what the provider actually supports"; "Never emulate missing permission modes" | [M] t3:docs/internals/03_providers.md:3-50 |
| Agents | Claude Code, Codex, Cursor, OpenCode, Grok Build, Antigravity, Kiro, Pi, Muse Code, fx, any ACP agent | [M] t3:README.md:28 |
| How it drives Claude / Cursor | Via `@anthropic-ai/claude-agent-sdk` and `@cursor/sdk` (patched) rather than the plain CLIs | [M] t3:apps/server/package.json:38-39, t3:patches/@cursor__sdk@1.5.0.patch. The claude-agent-sdk-typescript repo shows no OSI license on GitHub [M] GH-API anthropics/claude-agent-sdk-typescript (`license: null`) |
| Remote | Packages `ssh` (auth, tunnel, command) and `tailscale`; "Linked environments" (beta) let agents on one machine launch/message/delegate to threads on another; T3 Connect relay | [M] t3:packages/ssh/src/, t3:packages/tailscale/src/, t3:docs/user/remote-access.md:72-78 |
| Isolation | None at the OS level: "Projects are organizational boundaries, not filesystem sandboxes"; permission modes are each provider's own approvals; default for new threads is **Full access** | [M] t3:docs/internals/04_environment-auth.md:147, t3:docs/user/permission-modes.md:5 |
| Budgets | No $/token caps found. "Budget" in docs means payload or context-handoff budgets (`T3CODE_CONTEXT_HANDOFF_TOKEN_CAP` default 16000) | [M] rg "budget" in t3:docs; t3:docs/user/portable-handoffs.md:18 |
| Extras it already has | Subagents/delegation across providers and linked machines; durable "Workflows" (TS scripts with steps, schedules, webhooks, approvals); scheduled tasks; Linear issue tracker package; guest links; PR review guides; many git hosts | [M] t3:docs/user/subagents.md, t3:docs/user/workflows.md:3, t3:packages/issue-tracker-linear, t3:docs/user/guest-links.md, t3:apps/server/src/persistence/PullRequestReviewGuides.ts |

**Telemetry defaults (note for mehdi):**
- Product usage events go to `https://ingest.t3.codes` by default, with a built-in ingest key [M] t3:apps/server/src/telemetry/AnalyticsService.ts:71-76.
- On by default unless a CI env var is set: `enabledByDefault = !isCiEnvironment(...)` [M] t3:apps/server/src/telemetry/AnalyticsService.ts:155-156.
- Events carry provider, model name, reasoning effort, permission mode, outcome, duration, release channel and token counts under a hashed install ID; "prompts, responses, file contents, and credentials are never included" [M] t3:docs/user/telemetry.md:3-7.
- Off switch: `T3CODE_TELEMETRY_ENABLED=false` or `DO_NOT_TRACK=1` (wins) [M] t3:docs/user/telemetry.md:11. T3 Connect relay traces go to Axiom unless also disabled [M] t3:docs/user/telemetry.md:18.
- It reads `~/.claude.json` and Codex `auth.json` (e.g. reset-credit and login watchers) regardless of telemetry [M] t3:apps/server/src/provider/claudeResetCredits.ts:248-249, t3:apps/server/src/provider/Drivers/CodexDriver.ts:408-411. For Flotilla: any copied code must not read vendor credential files [I].

**Fit verdict [I]:** excellent *reference* for adapters, remote linking and event-sourcing; poor *base*. It is a single-user, local-first control plane on SQLite with no sandbox and no caps; it uses the Claude Agent SDK where mehdi's rule says "official unmodified CLI"; telemetry must be stripped; trademark scrub everywhere; and Effect-TS across ~1M lines is a steep climb for one 16-year-old dev.

---

## 4. The three options (the brief's table)

Scores 1-5, higher is better. All scores are [I] from the facts above; effort is [G].

| Criterion | (a) Fork firstmate | (b) Build on T3 Code | (c) From scratch (hybrid, recommended) |
|---|---|---|---|
| **Parity fit** (vs 639 rows in CAPY.md §15) | **2.** Has crews, a zero-token watcher, 19 harness fact sheets, remote "secondmates" over SSH [M] FIRSTMATE.md §2-5. Lacks: server, web UI, API, previews, review agent, automations, Drive, multiplayer, cloud machines, budgets, isolation [M] FIRSTMATE.md §11. | **3.** Has threads, web/desktop/mobile UI, 11 agents + ACP, subagents, workflows, schedules, PR flow, review guides, Linear, remote linking [M] §3. Lacks: Captains as a product, container isolation, hard caps, multi-user server, cloud machine pool, cloud phones. | **2 at start, 5 by design.** Nothing exists on day 1; every shape is chosen for parity (Thread/Captain/Run/Machine/…). |
| **License** | **5.** MIT; all deps MIT (§1). | **4.** MIT code; trademark rules; Claude Agent SDK dep has no OSI license on GitHub [M]. | **5.** We pick only MIT/Apache/BSD/ISC parts (§5). No AGPL. |
| **Stack** | **1.** ~148k lines of bash, 303k lines of shell tests, LLM-as-loop-owner [M] FIRSTMATE.md §1, §13. Can't host a multi-user server or enforce a kernel. | **3.** Modern TS, good tests, but Effect-TS everywhere, SQLite, Electron/RN surfaces we don't need yet [M] §3. | **4.** Plain TypeScript + zod, Postgres, Docker; one language end to end; boring and teachable. |
| **Effort for one dev** | **2.** Porting bash to a server = rewrite anyway. | **2.** ~1.08M lines to learn; adding kernel, caps, containers and multi-user touches the core; fast upstream churn means rebase pain. | **3.** Phase 1 is a small, well-bounded core (ROADMAP.md). Guess: phase 1 ≈ 8-12 Devin-sized units [G]. |
| **Lock-in** | **4.** Many CLIs; but control via tmux/terminal scraping [M] fm VISION.md:64-66. | **3.** Open, many agents, but drives Claude/Cursor via vendor SDKs; tied to its Effect runtime and release cadence. | **5.** Adapters over official CLIs and ACP; Postgres; Docker. Swappable. |
| **mehdi's hard rules** (kernel, $ caps, isolation, no Claude-token proxy, self-host compose) | Miss 3 of 5 (no kernel, no caps, no isolation) [M] FIRSTMATE.md §6-7, §13 | Miss 3 of 5 (no kernel, no caps, no isolation); telemetry on [M] §3 | Built in from unit 1 |
| **Total (of 30)** | 16 | 18 | 24 |

**Pick: (c), hybrid.** Exactly which parts come from where is in §6.

### 4a. Other candidates checked (why not them)

| Candidate | License (GH-API, today) | Why not as base | What we take | Label |
|---|---|---|---|---|
| OpenHands (now `OpenHands/OpenHands`) | MIT, TypeScript, 94k stars | Its own agent harness (lock-in against "every agent") [I from README, unverified]; big; "root now an Electron/TS app" [G from GH-API language field only, unverified] | Idea: sandbox runtime per session | [M] GH-API (redirected from All-Hands-AI/OpenHands); fit [I] |
| Open SWE (now "Robin") | MIT, Python | README: "Deploying it as is requires Managed Deep Agents"; not accepting contributions; LangGraph-tied | Ideas: `/baby-sit` CI monitoring that reruns only evidence-backed flaky jobs; per-thread persistent sandbox; "unreachable sandbox is not silently replaced" | [M] https://github.com/langchain-ai/open-swe README; fit [I] |
| Vibe Kanban | Apache-2.0, Rust | README: "Vibe Kanban is sunsetting" | Idea: issues board → workspaces per agent | [M] https://github.com/BloopAI/vibe-kanban README |
| coder/agentapi | MIT, Go | **Archived** (last push 2026-09-13) | Idea only: HTTP wrapper over a terminal agent | [M] GH-API `archived: true` |
| Claude Squad, Coder | AGPL-3.0 | Brief rule: no AGPL in core | Nothing | [M] BOT-BRIEF.md "Known so far" |
| Hatchet (what Capy uses) | MIT, Go | Extra service to run in compose; pg-boss covers phase 1-2 | Keep as an upgrade path | [M] GH-API hatchet-dev/hatchet; Capy use [M] CAPY.md §4 |

---

## 5. Building blocks

| Layer | Choice | Alternatives considered | Why | Label |
|---|---|---|---|---|
| Language / runtime | **TypeScript on Node 22**, pnpm monorepo, zod for wire schemas | Go (fast, single binary); Effect-TS (what T3 uses) | One language for server, runner and web; mehdi already in TS land; zod is simpler than Effect for one dev; T3/firstmate TS bits port directly | [I] |
| HTTP / realtime | **Hono** (MIT) + Server-Sent Events for event streams, WebSocket only for terminal | Fastify, tRPC | Small; SSE matches Capy's API shape (CAPY.md §13 "Expose an SSE stream") | Hono MIT [M] GH-API honojs/hono; rest [I] |
| Database | **Postgres 16** in compose; **Drizzle** (Apache-2.0) migrations | SQLite (T3) | Multi-user, LISTEN/NOTIFY (P1 SSE fan-out), pg-boss needs it (P2), one more container is fine for compose | Drizzle Apache-2.0 [M] GH-API; [I] |
| Job queue / durable work | **pg-boss** (MIT, TS), **from P2** (P1 has no queue; REVIEW-2 F-18/F-26): cron schedules, retries, singleton keys, throttling, on the same Postgres | graphile-worker (MIT, TS; LISTEN/NOTIFY, very low latency, cron too); Temporal (MIT; separate server cluster, heavy for compose); Hatchet (MIT; Capy's choice) | No extra service; schedules cover automations (5-min floor in Capy); thread state lives in our own event log, so the queue only runs short jobs and wakes | licenses [M] GH-API timgit/pg-boss, graphile/worker, temporalio/temporal; choice [I]. pg-boss feature list from memory of its docs: **unverified** today |
| Sandbox (phase 1) | **One Docker container per thread** via Docker Engine API (dockerode, Apache-2.0): non-root user, `--cap-drop ALL`, no Docker socket, read-only base + writable `/workspace` volume, CPU/RAM/pids limits, egress allowlist optional | Kata (Apache-2.0), gVisor `runsc` (Apache-2.0), Firecracker (Apache-2.0), E2B self-host (now `e2b-dev/runtime`, Apache-2.0) | Works on every Linux and Docker Desktop; `docker compose up` stays one command. Stronger runtimes become a per-machine `runtime:` option later (gVisor/Kata = one Docker runtime flag; Firecracker/E2B = phase 4) | licenses [M] GH-API; choice [I] |
| Docker-in-thread (Capy has it, CAPY-208) | **sysbox** runtime (Apache-2.0) when installed, else disabled with a clear "needs you" | privileged DinD (unsafe) | Avoid `--privileged` | sysbox Apache-2.0 [M] GH-API nestybox/sysbox; safety [I] |
| BYO machines | **`flotilla-runner`** (same TS codebase, single binary via Node SEA or bun build [G]) that **dials out** to the server over WebSocket+TLS; reach the server via **Tailscale** (BSD-3) or an **SSH** reverse tunnel (`ssh -R`, ssh2 MIT). Runner starts each thread in a container or VM by default (Docker; Colima/OrbStack/Lima on macOS); a **dedicated OS user** (`flotilla-t<id>`) is opt-in only, labelled reduced isolation and refused on shared machines (SPEC.md §6a, REVIEW-2 F-13) | frp (Apache-2.0), cloudflared (Apache-2.0) as optional public tunnels | Outbound-only works behind NAT; no inbound port on the laptop; matches mehdi's "SSH/Tailscale" rule | licenses [M] GH-API tailscale/tailscale, fatedier/frp, cloudflare/cloudflared, mscdex/ssh2; design [I] |
| Preview URLs | P1: the server's own reverse proxy on a **separate origin** (`:8081`), preview-only token cookie, never the UI cookie (review fix, SPEC.md §6c). P2: **Caddy** (Apache-2.0) wildcard `https://p<port>-<thread-code>.<FLOTILLA_PREVIEW_DOMAIN>` (SPEC.md §6c is canonical) on a domain separate from the UI; optional public share link | Traefik | Auto-TLS, simple config API | Caddy Apache-2.0 [M] GH-API; [I] |
| Browser QA | **Playwright + Playwright MCP** (Apache-2.0) in the thread image; desktop stream via noVNC later | chrome-devtools-axi (MIT) | Vendor-neutral; any agent can call it via MCP | licenses [M] GH-API microsoft/playwright-mcp, BOT-BRIEF.md; [I] |
| Mobile QA (phase 4) | Android emulator on KVM-capable BYO hosts + Maestro/Appium (Apache-2.0); iOS only on a BYO Mac | Revyl (what Capy uses, paid) | Self-host friendly | licenses [M] BOT-BRIEF.md; [I] |
| Web UI | React + Vite SPA served by the server | Next.js | No SSR needed; one container | [I] |

---

## 6. Recommendation: what we reuse vs what we write

**Decision:** (c) from scratch, hybrid. New repo, new name, MIT license (so users can fork freely). [I]

### 6a. Reused (with attribution in `THIRD_PARTY_NOTICES.md`)

| From | What | How | Label |
|---|---|---|---|
| firstmate (MIT) | 19 harness fact sheets (launch flags, resume, interrupt, auth preflight, trust dialogs) | **Port** into typed `AgentAdapterManifest` JSON/TS; keep only facts that apply to headless mode; re-verify each against vendor docs | [M] source FIRSTMATE.md §12.1; plan [I] |
| firstmate | Status-event vocabulary `done / needs-decision / blocked / failed / paused / captain-held / resolved` | **Port** into the `Event` and `Approval` types | [M] fm:bin/fm-classify-lib.sh:84-149 |
| firstmate | Watcher triage: absorb vs surface, 30 s coalescing, heartbeat backoff 600→7,200 s, wedge ladder with a cap, dead-endpoint suppression | **Re-implement** in TS inside the Captain scheduler | [M] fm:bin/fm-watch.sh:2-80, 346-371 |
| firstmate | Hard rules (never merge red, never delete unlanded work, workers never talk to the human directly) | **Re-implement as kernel guards in code** | [M] fm:AGENTS.md:26-43 |
| firstmate | Durable steer inbox + doorbell; data-plane vs control-plane split | **Port** as `Message` (data) vs `Control` (interrupt/stop) commands | [M] fm:AGENTS.md:217-221 |
| firstmate | Hermetic fake harness / fake server tests | **Pattern** for `fake-agent` adapter used in all tests | [M] fm:tests/t3-fake-server.mjs |
| T3 Code (MIT) | Event-sourcing shape: pure decide → one transaction (events + projections + receipts + outbox) → effect worker | **Pattern**, re-written (P1 keeps events + rows in one transaction and skips receipts/outbox, SPEC.md §4), without Effect, on Postgres | [M] t3:docs/internals/01_architecture.md:30-47 |
| T3 Code | Adapter rules: capabilities not names; declare only what's supported; never emulate permission modes; strict ACP | **Adopt as written rules** in SPEC.md §5 | [M] t3:docs/internals/03_providers.md:3-60 |
| T3 Code | `packages/effect-acp`, `packages/effect-codex-app-server` | **Read as protocol references**; copy small pure-TS parsing pieces only if they don't drag Effect in | [M] t3:packages/; copy decision per file [I] |
| T3 Code | Hidden-git-ref checkpoints | **Pattern** for thread checkpoints and "Continue on" moves | [M] t3:docs/internals/01_architecture.md:60-62 |
| T3 Code | `packages/ssh`, `packages/tailscale` | **Reference** for runner pairing; rewrite (they use Effect) | [M] t3:packages/ssh/src, t3:packages/tailscale/src |
| Capy (no code, ideas only) | Typed "needs you" asks, PR ownership = last pusher, idempotent `requestId`, SSE frames, untrusted event payloads, non-overridable rules | **Design inputs** | [M] CAPY.md §13 |
| Libraries | pg-boss (P2), Hono, Drizzle, dockerode, ssh2, zod, Playwright MCP, Caddy (P2), Tailscale | **Depend on** | licenses [M] §5 |

### 6b. Written new (Flotilla's own core)

1. Domain model and Postgres schema: Thread, Captain, Run, Machine, AgentAdapter, Event, Approval, Automation, DriveItem (named in SPEC.md §4 before code) [I].
2. **Kernel**: budget meter + cap enforcement, merge/push guard, secret scrubber, isolation assertions, approval gate. Hooks cannot disable it [I].
3. **Hook runtime** for the user-modifiable orchestrator: versioned hook bundles, replay tests against recorded event logs, one-click rollback [I].
4. Adapter host: `claude-code`, `codex`, `generic-cli`, `fake` (phase 1); `cursor`, `gemini`, `acp`, `devin` (phase 2); `native` harness (phase 2, benchmarked before default) [I].
5. Machine pool: local Docker driver + `flotilla-runner` (phase 2) [I].
6. GitHub integration (App or fine-grained PAT), PR ownership and CI autofix loop with attempt cap [I].
7. Captain scheduler (fan-out, digest, triage) [I].
8. Web UI (event stream, needs-you, digest, cost) [I].
9. `docker-compose.yml`: `server`, `postgres`, `gate` (egress allowlist) in P1; `caddy` and optional `runner` from P2 [I].

### 6c. Explicitly not copied

- firstmate's bash scripts and tmux/terminal-scraping control plane [M] FIRSTMATE.md §13.
- T3 Code's branding, telemetry module, Claude Agent SDK driver, and anything that reads `~/.claude.json` or Codex `auth.json` [M] §3.
- Capy's `claude setup-token` pattern: Flotilla never stores or proxies Claude.ai credentials. The official `claude` binary runs inside the user's thread container or runner and the user signs in through `claude auth login` themselves; or they supply a Claude Console API key [M] Anthropic: "developers may not collect, store, or intermediate Claude.ai credentials" https://code.claude.com/docs/en/legal-and-compliance (fetched today).

---

## 7. Open items

1. **Claude login inside a container — decided** (mehdi, Nov 27, 2026 PKT; see SPEC.md §15). Each user's `claude auth login` state lives on a per-user Docker volume mounted only into that user's threads, never read by the server. Tokens are never proxied or sent off the operator's infra. A Console API key remains an option. Whether a volume on the operator's host counts as "storing" under Anthropic's terms is still **unverified** and is recorded as a known risk.
2. **Container strength.** Plain Docker shares the host kernel. Good enough for phase 1 on your own box; for running untrusted PRs, gVisor/Kata per machine should be offered early (phase 2-3) [I].
3. **pg-boss vs graphile-worker**: both fit; pick pg-boss for built-in cron. Re-check pg-boss's current API (v10+ is said to need `createQueue()` before `send()`/`schedule()`) when the P2 automations unit is written (**unverified** today) [I].
4. **Devin as a crew engine** runs on Cognition's VMs, so isolation, transcripts-local and container rules can't apply in the same way; it's an explicit "remote engine" class with a warning [I].
5. **Name collision**: stitchfix/flotilla-os and tylertreat/Flotilla exist (Apache-2.0) [M] BOT-BRIEF.md. Keep the name for now; decide before any public repo.

---

## Sources

- Local: `research/t3code/` (README.md, AGENTS.md, LICENSE, TRADEMARK.md, docs/internals/01_architecture.md, 03_providers.md, 04_environment-auth.md, docs/user/telemetry.md, permission-modes.md, subagents.md, workflows.md, guest-links.md, remote-access.md, portable-handoffs.md, providers-claude.md, apps/server/package.json, apps/server/src/telemetry/AnalyticsService.ts, packages/shared/src/otelEnvironment.ts, packages/provider-core/src/server/ProviderAdapter.ts); `research/firstmate/` (docs/configuration.md, bin/fm-bootstrap.sh); `research/CAPY.md`; `research/FIRSTMATE.md`; `DEVIN-PLAYBOOK.md`; `BOT-BRIEF.md`.
- GitHub API (Nov 27, 2026 PKT): kunchenguid/{treehouse, no-mistakes, gh-axi, tasks-axi, quota-axi, chrome-devtools-axi, lavish-axi, firstmate}, pingdotgg/t3code, OpenHands/OpenHands, langchain-ai/open-swe, BloopAI/vibe-kanban, coder/agentapi, agentclientprotocol/agent-client-protocol, agentclientprotocol/claude-agent-acp, anthropics/claude-agent-sdk-typescript, hatchet-dev/hatchet, timgit/pg-boss, graphile/worker, temporalio/temporal, e2b-dev/runtime, firecracker-microvm/firecracker, kata-containers/kata-containers, gvisor/gvisor, nestybox/sysbox, tailscale/tailscale, fatedier/frp, cloudflare/cloudflared, caddyserver/caddy, honojs/hono, drizzle-team/drizzle-orm, apocas/dockerode, mscdex/ssh2, microsoft/playwright-mcp, openai/codex, google-gemini/gemini-cli.
- npm registry: gh-axi, chrome-devtools-axi, tasks-axi, quota-axi, lavish-axi, no-mistakes, treehouse (`/latest`).
- Vendor docs (fetched today): https://code.claude.com/docs/en/headless, https://code.claude.com/docs/en/legal-and-compliance, https://developers.openai.com/codex/noninteractive, https://developers.openai.com/codex/app-server, https://cursor.com/docs/cli/headless, https://geminicli.com/docs/cli/headless/, https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions, https://agentclientprotocol.com/protocol/overview.
- READMEs: https://github.com/langchain-ai/open-swe, https://github.com/BloopAI/vibe-kanban.
