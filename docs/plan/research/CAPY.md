# CAPY.md: Capy, reverse-engineered from public sources

Step 1 of the Flotilla first-job playbook. Written Nov 26, 2026 (PKT). Public material only: no login, no private endpoints. I read the Dock installer but did not run it.

## How to read this

- **[M] measured**: I read it myself in the cited source on Nov 26, 2026. For vendor pages, "measured" means "Capy says this". It does not mean I tested it.
- **[I] inferred**: my conclusion from one or more cited sources.
- **[G] guess**: a plausible reading with thin evidence.
- **unverified / not public**: I couldn't check it, or nothing public says it.

**Citation shorthand**
- `F:L123` → `research/capy-llms-full.txt` line 123 (the docs.capy.ai full dump; each section's URL is in its `# Title (URL)` header).
- `OA:<Schema>` → `research/capy-openapi.json` (fetched today from https://docs.capy.ai/openapi.json: OpenAPI 3.1, 90 paths, 210 schemas).
- `INST:L12` → `research/capy-dock-install.sh` (fetched from https://downloads.capy.ai/stable/dock/install.sh; read, not run).
- `GS:L12` → `research/gstack-capy.md`, byte-identical to https://github.com/garrytan/gstack/blob/main/capy/README.md (I checked with diff).
- `CL` → https://capy.ai/changelog. `PR` → https://capy.ai/pricing. `LI` → https://capy.ai/llm-info. `FC` → https://capy.ai/features/captains. `SP` → https://capy.ai/subprocessors. `RA` → https://rankagents.app/blog/capy-ai-review (a third-party review, Nov 23, 2026).

---

## 0. The short version

Capy is a hosted, closed-source service from Scrapybara, Inc. (YC F24). You give it a task, and an agent works on it in a "thread", either on a cloud VM or on your own computer. It opens a GitHub PR, then keeps fixing it as CI results, reviews and merge conflicts come in. A **Captain** is a long-lived thread that starts and directs other threads (its "crew"). It keeps its plan in Markdown files and shows you a "Needs you" digest. Every model runs inside **Capy's own agent harness**. You can bring your own keys or subscriptions for tokens, but you can't plug in Claude Code, Codex CLI, Cursor, Gemini CLI or Devin as the engine. Your data lives in Capy's cloud even when the thread runs on your laptop. There is no per-thread or per-Captain hard spend cap, and a laptop run is not sandboxed.

The full, numbered feature inventory for parity tracking is in §15.

---

## 1. Domain model (plain words → technical mapping)

| Plain words | Capy name | Mapping | Label + source |
|---|---|---|---|
| One job with one agent | **Thread** | "One conversation with one Capy agent about one piece of work, along with its machines, subagents, and pull requests." API object `ThreadEncoded`. IDs look like `jam_01...`, so "jam" is probably the internal name. | [M] F:L4542, OA:ThreadEncoded, F:L5918 (`"threadId":"jam_01..."`), OA:ThreadCaptain.jamId; "jam" being internal is [I] |
| Human-readable ID | Thread code | Project code + number, e.g. `HOME-14`, `CAPY-412` | [M] F:L4654-4656 |
| Long-lived boss agent | **Captain** | A thread promoted to orchestrator. The API schema `CaptainEncoded` has the same fields as `ThreadEncoded` (status, needsYou, crewCount, etc.). | [M] F:L802-806, OA:CaptainEncoded; "a Captain is a thread with a role flag" is [I] |
| The workers a Captain runs | **Crew** / crew thread | A full thread on its own machine. It starts from the Captain's brief only and reports to the Captain. A thread can be in only one crew. | [M] F:L806, F:L825, F:L587 |
| Helpers inside one thread | **Subagent** (old name: "task") | A child agent that starts from its prompt alone. Nesting goes up to 3 levels deep. Addressed as "Subagent 1.3". The API is read-only. | [M] F:L4433, F:L4441, F:L5684, F:L5723 |
| Quick side question | **Side chat** | A full copy of the conversation on the same machine. Doesn't report back. | [M] F:L584 |
| Branch the conversation | **Fork** | A full copy or a summary, on a fresh machine | [M] F:L585, F:L595 |
| Repos + setup + env vars | **Project** | Decides repos, setup scripts, env vars and machine size | [M] F:L4613, F:L1918 |
| Shared files outside git | **Drive** (old name: Volumes) | Scopes: Organization, Personal, Project, Project+personal, Automation, and one per Captain | [M] F:L1841-1859 |
| Where it runs | **Machine** / **Device** | A cloud Firecracker VM, or a paired desktop or Dock CLI device | [M] F:L3461, F:L1748 |
| Recurring or event job | **Automation** | A stored prompt plus 1-20 triggers. Each run is a normal thread. | [M] F:L639, F:L705 |
| Work items | **Issues** | Built-in tracker: states, labels, relations, sub-issues, a board (0.10.0) | [M] CL 0.7.0, CL 0.10.0, F:L7662-8551 |
| Needs a human | **Needs you** flag + `ask` | Kept separate from status. `ThreadAsk.kind` ∈ conversation, environment, mcp, credits, desktop, feedback, terminal | [M] F:L4581-4585, OA:ThreadAsk |
| Org identity for bots | **Service user** | A non-human principal for API keys and automations | [M] F:L115-117 |

**Captain Drive files** [M] F:L847-854
- `AGENTS.md`: the Captain's own rules.
- `CREW.md`: rules every crew thread reads on every turn.
- `NOTES.md`: plan and working notes.
- `DIGEST.md`: what you see in the Digest tab.
- `skills/`, `reports/`, `renders/`, `handoffs/`.

The API reads the digest from `DIGEST.md`, falling back to `ONGOING.md`, then `NOTES.md`, with a 64 KiB cap [M] OA:CaptainDigestEncoded. The Captain "rereads its plan, rules, and crew state each time it wakes" [M] F:L2331. So memory is files, not chat history [I].

**Naming history (important).** The current "Captain" is not the Captain from early 2026.
- **Feb 2026**: "Captain" was a read-only planner, and "Build" was the executor on an Ubuntu VM [M] https://capy.ai/blog/captain-vs-build.
- **Apr 16, 2026**: Build mode was deprecated. Captain became the entry point and "delegates implementation to Build agents" [M] https://capy.ai/blog/april-2026-update.
- **Aug 11, 2026**: the changelog restarts at "Capy Beta" [M] CL.
- **Sep 24, 2026 (0.3.0)**: Captain is an Experiment again, now described as "a long-running thread that directs other threads as its crew" [M] CL 0.3.0.
- **Oct 31, 2026 (0.7.0)**: Captains went GA [M] CL 0.7.0.
- My reading: the product was relaunched around Aug 2026 and the name was reused [I].
- The YC jobs page still describes "Scout … an AI-native software engineering agent" on its own VM, which may be an older product name [G] https://www.ycombinator.com/companies/capy/jobs.

---

## 2. Lifecycle and state of a run

**Thread status** [M] F:L4572-4577, OA:ThreadEncoded.status

| Status | Meaning |
|---|---|
| `working` | The agent or a subagent is working |
| `waiting` | Parked on CI, a subagent, a timer or a long command |
| `failed` | The last turn ended on an error |
| `idle` | At rest |
| `archived` | API-only status: doesn't run. Events arrive as context, and a message unarchives it (F:L4627). |

- Users can't set status by hand. **Needs you** is a separate flag, so a thread can need you while it waits on CI [M] F:L4570, F:L4583-4585.

**Turns and wakes** [M] F:L529-538
- A thread runs in turns. A new turn starts on:
  - a human message
  - CI results on a PR the thread owns
  - human reviews or comments (bot feedback is ignored by default)
  - a merge or conflict, but only if someone wrote in the thread in the last 3 days
  - another agent
  - a timer (up to 7 days), a background command, or a watch (GitHub, Slack or webhook; up to 30 days)
- Each event type can be set to React, Keep as context, or Ignore [M] F:L542, F:L4116-4123.

**Streaming frames (SSE)** [M] F:L5914-5958
- Frames: `status`, `run {phase:start|end}`, `turn {phase:start|end, outcome:"settled"}`, `tool_call`, `assistant` (deltas), `transcript` (committed, with an `id:` cursor).
- Reconnect: `retry: 2000`.

**Subagent states** [M] F:L4461-4467, OA:SubagentEncoded
- `draft` → `working`/`waiting` → `idle`/`done`/`failed`.
- A draft holds an editable prompt and does nothing until started.

**Messaging a busy agent** [M] F:L4548-4552, F:L566-574
- Steer (default, at the next step), Queue (after the turn), Interrupt (right away).
- Slack, Linear, API and PR comments interrupt by default.

**Machine lifecycle** [M] F:L3576-3605
- Sleeps about 2 min after the thread stops, unless:
  - the agent is waiting on a background command (max 6 h; default timeout 30 min)
  - a tab is open
  - someone uses a preview
  - "Keep awake 4h" is on
- The disk survives sleep. Processes don't.
- Deleted after 14 days asleep, along with unpushed work [M] F:L3589.

**Laptop thread offline**
- Waits up to 24 h [M] F:L1697.
- Can auto-move to the cloud using a cloud checkpoint of uncommitted work, which is on by default [M] F:L1699, F:L155.

**Automation runs** [M] F:L787, OA:WebhookBatchStatus
- An over-cap run is recorded as `skipped`.
- Webhook batches are `collecting` → `queued` | `cancelled`.

**Billing stop**
- When the balance is empty, the thread stops with "Your organization is out of credits".
- It doesn't resume by itself; you must send a message or retry [M] F:L4009-4011.

---

## 3. Agent engine, models, and harnesses

### 3a. Capy's native agent engine

**What it is.** Capy runs its own agent loop, which I'll call "Capy's harness". It gives the model Capy's tools: shell, browser/desktop, PRs, subagents, Drive, MCP, automations and Slack tools.
- Every catalog model runs inside it. "Instructions apply to every model" [M] F:L619.
- Docs: "Capy's tools, machines, subagents, and pull requests work the same" when a Claude plan runs on the Claude Agent SDK [M] F:L3805.
- Third-party review: "Capy runs its own unified agent harness … It does not wrap third-party CLI harnesses such as Claude Code or Codex CLI as interchangeable engines" [M] RA. RA is a secondary source, so treat this as Capy's documented position plus RA's reading.

**Known internals**
- **"Codemode."** Tool calls happen inside programs the model writes ("Tool calls inside a codemode program show their input and output"; "Codemode works better on every frontier model, with fewer extra lookups and refused calls") [M] CL 0.4.4, CL 0.4.7. Codemode probably means the model writes a script that calls tools, rather than one JSON tool call per step [I].
- **Captain prompts.** The Feb 2026 Captain prompt says "You are a technical architect who PLANS but never IMPLEMENTS". The Build prompt says "You are an autonomous AI agent with access to an Ubuntu virtual machine…" [M] https://capy.ai/blog/captain-vs-build. Whether today's Captain still uses these prompts is unverified.
- **Context compaction.** "Compact at" is an org setting per model [M] F:L3968.
- **Context breakdown.** Settings shows the tokens each instruction layer takes [M] CL 0.7.0.
- **Rules it reads.** Repo and nested `AGENTS.md`, root `CLAUDE.md` as a fallback, `.capy/rules/` and `.cursor/rules/` (`.md`/`.mdc` with `globs`/`alwaysApply`), and skills in `.agents/skills/` or `.claude/skills/` [M] F:L2498, F:L2519-2537, F:L2620-2622, F:L2383.
- **Hard-coded rules no instruction can override** [M] F:L231, F:L623, F:L2281:
  - never merge unless you ask in the thread
  - never expose or commit secrets
  - never fabricate results
- **Safety shape.** It's prompt-level ("Capy's instructions tell it never to merge…") [M] F:L231, backed by product limits: cloud machines hold no GitHub token [M] F:L229, and review machines can read but can't push [M] F:L229. A model-proof enforcement layer for the no-merge rule (like a kernel) is not documented [I].

**How it differs from third-party harnesses**
- One tool and permission model for all models. You can't run the official Claude Code, Codex CLI, Cursor agent, Gemini CLI or Devin binaries as a thread's engine. None of the docs mention it, and RA states it [I from F + M RA].
- **Exception, Claude subscription.** A Claude Pro/Max plan runs "as Claude Code", described as "a different harness from Capy's own agent: it runs on the Claude Agent SDK" [M] CL 0.5.0.
  - Connection: you run `claude setup-token` and paste the token into Capy [M] F:L3807.
  - Capy stores and uses a Claude subscription token server-side [I]. The brief's Anthropic terms say third parties may not route requests through subscription credentials. Whether Capy's setup complies is a question for Anthropic and Capy; it's **unverified** and not for us to decide. **Flotilla must not copy this.**
- **Codex, Copilot, SuperGrok subscriptions** connect by device code. Capy then serves those models through its own harness [M] F:L3919, F:L3801.
- **Imports.** The desktop app can import local Claude Code and Codex *sessions/histories* as threads [M] F:L2391, CL 0.2.0. It also imports MCP configs from Claude Code JSON or Codex TOML [M] F:L2859.

### 3b. Models and model choice

- **Catalog.** About 65 models from Anthropic, OpenAI, xAI, Google, Moonshot, Z.ai, DeepSeek, Qwen, MiniMax, Xiaomi, Tencent, Meituan, Meta, NVIDIA, Particle and Thinking Machines. Prices are per 1M tokens at "list price, no markup" [M] F:L3720-3787.
  - The default is `anthropic/claude-opus-5-5` [M] F:L3725.
  - Two "free with ads" models, web/desktop only, in 6 countries, with no ZDR [M] F:L3789-3797.
- **Who picks the model**
  - Per thread, set in the composer.
  - Crew threads use the Captain's model unless you or the Captain pick another [M] F:L810.
  - Subagents inherit the parent's model; the agent may pick cheaper or stronger ones [M] F:L4005, F:L4483.
  - Automations are pinned or unpinned [M] F:L735-740.
  - API: a named model "never falls back" [M] F:L6793.
  - Reasoning effort ranges `none`…`max`. Modes: fast/pro/ultrafast/daybreak [M] OA:ModelSelection, F:L3898.
- **Connections, in order:** owner's connections → org connections → Capy credits [M] F:L3902.
  - Subscriptions: Claude Code, Codex, GitHub Copilot, SuperGrok.
  - Gateways: Vercel AI Gateway, OpenRouter, Cloudflare, Ollama Cloud, Bedrock, etc.
  - API keys: Anthropic, OpenAI, xAI, Google, Meta.
  - Any OpenAI-compatible custom endpoint [M] F:L3912-3917.
  - **Inconsistency:** PR and LI list subscriptions as ChatGPT (Codex), Copilot and SuperGrok only, with no Claude [M] PR, LI. The docs and CL 0.5.0 include Claude [M].
- **Run-out policy** when a subscription is used up: "Ask me" / "Ask before Capy credits" (default) / "Keep going" [M] F:L3946-3954.
- **Capy's own guidance on which model to use as Captain**
  - Users mostly ran Opus/Sonnet as Captain and GPT for Build.
  - GPT-5.5 is "viable" as Captain, but its review-and-fix loops "do not converge" [M] https://capy.ai/blog/gpt-5-5-captain-eval.
  - Claude Opus 4.7 was the default Captain model in April [M] blog april-2026-update.
- **Side note on the brief's model list.** `google/gemini-4-neon` is in Capy's catalog: 1.05M context, $3 in / $15 out [M] F:L3766. That shows the model name exists. Access terms for Flotilla's own use are still unverified.

---

## 4. Compute

**Cloud VM** [M] F:L3444-3469
- One per thread.
- Firecracker microVM, own Linux 6.1 kernel, Ubuntu 24.04 x86_64, US East (New York) only.
- User `user` with passwordless sudo. Repos cloned under `/workspace`.
- XFCE desktop with Chrome, streamed to the pane.
- No swap.

**Sizes and prices** [M] F:L3446-3453, PR

| Size | Specs | Price | Plan |
|---|---|---|---|
| Small | 1 vCPU / 4 GB / 64 GB | $0.10/h | Lite and up |
| Medium | 2 vCPU / 8 GB | $0.20/h | Lite and up |
| Large (default) | 4 vCPU / 16 GB | $0.40/h | Lite and up |
| Ultra | 8 vCPU / 32 GB | $0.80/h | Pro+ |
| Hyper | 16 vCPU / 64 GB / 128 GB | $1.60/h | Max+ |
| Big Guy | 16 vCPU / 128 GB / 256 GB | $3.20/h | on request |

- Billed while awake, plus a 2-min wind-down [M] F:L3484.

**Concurrency is limited by plan RAM** [M] F:L3492-3503
- Lite: 128 GB (8 Large machines). Pro: 512 GB (32). Max: 1 TB (64).
- API service-user threads get at most half of that by default.

**Kernel limits** [M] F:L3533-3546
- No `/dev/kvm`, so no nested Firecracker, QEMU-KVM or accelerated Android emulator.
- No kernel modules.
- Docker works.

**Other machine features**
- No SSH; you get a shell or desktop through the UI [M] F:L3642.
- Snapshots give fast boots and are tiered by disk size [M] F:L2062.
- Setup scripts `initialize` (900 s) and `refresh` (300 s), or commit `.capy/setup.json` [M] F:L1918, F:L1954-1955.

**Your machines**
- The desktop app (macOS/Windows/Linux) pairs your computer as a device [M] F:L1647-1651.
- The **Dock CLI** `capy dock` pairs a headless Linux (glibc), macOS or Windows machine [M] F:L1748-1758.
- Threads run in git worktrees under `~/.capy/worktrees` (new worktree by default, or an existing worktree, or your current checkout) [M] F:L1679-1683, F:L1806.
- Local runs have no machine-time charge [M] F:L1687.

**Installer details (read, not run)**
- Downloads from a CloudFront host [M] INST:L4.
- Refuses root unless `CAPY_DOCK_ALLOW_ROOT=1` [M] INST:L34-36.
- install.sh supports Linux and Darwin only (Windows uses install.ps1) [M] INST:L41-45, F:L1782.
- Checks the sha256 against `SHA256SUMS` [M] INST:L97-103.
- On macOS, verifies the codesign team `9YWUN5FK23` [M] INST:L5, L109-118.
- Runs `capy dock verify` against a manifest signed into the binary [M] INST:L126.
- Installs into `~/.capy/dock-install/<version>`, symlinks `~/.capy/bin/capy`, and appends a PATH line to your shell rc unless you pass `--no-modify-path` [M] INST:L128-192.
- Pairing uses a code or QR approved in the web UI and needs an interactive terminal the first time [M] F:L1795-1802.

**Sandboxing on your machine: none**
- "A linked folder sets where the agent starts, but it isn't a sandbox" [M] F:L225.
- "Threads can read and change anything that user can" [M] F:L1833.
- The agent runs under your git identity even when a teammate starts the thread [M] F:L225.
- Personal devices ask you to approve each message from elsewhere; shared devices can be reached by the team and by org API keys [M] F:L219-221.

**Moving between cloud and laptop ("Continue on")** [M] F:L1705-1722
- These move with the thread: branch, commits (unpushed too), staged/unstaged/untracked changes, and workspace files.
- These stay behind: `.gitignore`d files (`.env`, `node_modules`), untracked files over 2 MB, anything outside the workspace, and running processes.
- The move goes through the cloud and never pushes to GitHub.

**Cloud phones** [M] F:L1462-1627
- iOS and Android through Revyl (third party): build runners plus device sessions of at most 60 min.
- iPhone/iPad $5.40/h, Android $3.60/h. Pro+ only.
- The phone exposes a screen only, with no shell and no files.

**Infrastructure behind it** (stack hints from SP)

| Purpose | Provider |
|---|---|
| VM host | Latitude.sh bare metal (replaced Daytona on Oct 15, 2026) |
| Archived snapshots | Backblaze |
| Workflow orchestration | Hatchet (replaced Temporal, Oct 15, 2026) |
| Database | PlanetScale |
| Cache/queues/realtime | Upstash Redis |
| Traces/logs | ClickHouse |
| Search | turbopuffer |
| Auth | Clerk |
| Billing | Stripe + Autumn |
| Web hosting | Vercel |
| Edge | Cloudflare |
| Core cloud and Bedrock | AWS |
| Machine metrics | Grafana |

- All of the above is [M] SP.
- Firecracker runs on Latitude.sh bare metal [I], from SP and F:L3461.
- In 2025, Trigger.dev's CTO listed Capy.ai as a Trigger.dev user [M] https://news.ycombinator.com/item?id=45250720. It may no longer apply.
- API error tags like `capy/…Encoded`, and numbers encoded as `"Infinity"/"NaN"` strings, suggest an Effect-TS Schema backend [G] OA.

---

## 5. Integrations

| Integration | What it does | Label + source |
|---|---|---|
| GitHub (App) | Push branches, open PRs, act on CI, reviews and merges. **GitHub.com only; no GHES or other git hosts.** Cloud VMs hold no token (`git`/`gh` work through a proxy). | [M] F:L2631-2633, F:L2652; the proxy mechanism is [I] |
| GitHub App permissions | Contents, PRs, Issues, Actions and Workflows: write. Checks: read. Also GPG keys (signed commits), plus Deployments and Discussions, which are "granted, not used". You can't install with fewer. | [M] F:L235-251 |
| PRs | The agent never pushes to base/default/main/master/develop/release/*. Branch is `capy/<title>`. The thread that last pushed owns the PR and its events. Stacked PRs, including GitHub-native stacks. Merge from the Capy UI, including force merge with your bypass rights. | [M] F:L4081, F:L4131, F:L4135-4145, F:L4102-4110 |
| CI autofix | A failing check wakes the owner thread at once; passing checks arrive combined. With no CI, it wakes after about 30 min with a note. CI pickup is about 12 s. | [M] F:L4125, F:L4155, CL 0.10.0 |
| Review agent | A real checkout at the PR head. Findings carry Bug/Risk/Maintainability/Refactor category, High/Med/Low severity, and confirmed/investigate confidence. Inline comments at ≥medium. Triage states open/resolved/irrelevant. Re-reviews are incremental. Rules come from `AGENTS.md`. Low/Med/High cost 1/5/10 credits. **Never runs on your keys or subscriptions.** | [M] F:L4203-4277, F:L3982 |
| Guided review | Each reviewed PR gets a guide: an overview, the steps, and before/after views | [M] CL 0.4.4, LI |
| Slack | `@Capy` starts or continues a thread. Directives: `!steer`, `!queue`, `aside`. `captain=<name>` routes to a Captain. "Read Slack as you". DMs; waits for reactions. | [M] F:L3045-3074, F:L574, F:L887-896, F:L3094, CL 0.10.0 |
| Linear | Delegating an issue creates a native Linear agent session, mapped 1:1 to a thread | [M] F:L2744-2760 |
| MCP | Remote Streamable HTTP or local STDIO servers. OAuth, API key or none. Per org or per user, all projects or one. | [M] F:L2816-2840 |
| Plugins | MCP servers + skills. A marketplace "Verified by Capy", or a GitHub repo you sync by hand | [M] F:L2945-2965 |
| Vercel | Detects preview deployments from PR comments and checks | [M] F:L3392-3404 |
| Tailscale | VMs join your tailnet as tagged ephemeral nodes | [M] F:L3303 |
| Cloud creds | Capy is an OIDC issuer per machine/thread, for AWS, GCP, Azure, Vault and generic OIDC | [M] F:L1187+, CL 0.5.0, F:L1233 |
| Revyl | Cloud phones and mobile builds | [M] F:L1464 |
| Paper | Read and edit Paper files | [M] CL 0.4.5 |
| Public API | `https://api.capy.ai/api/v1`, bearer `capy_…` keys that act as a principal. Covers threads, messages, SSE streams, subagents (read-only), Captains (list/create/get/crew/digest), automations, reviews, usage, issues and folders. Idempotent `requestId`. | [M] F:L5688-5721, F:L4885-4899, F:L6788 |

---

## 6. Human-in-the-loop surfaces (what reaches a human, and how)

**The Needs you flag**
- Kinds: answer/decision, env vars, MCP approval, desktop hand, credits, feedback, terminal [M] F:L4583, OA:ThreadAsk.
- Shown with a "needs you" label, a sidebar marker and a tab marker, e.g. "Waiting on you to merge capy#8426" [M] CL 0.7.0.

**Captain digest**
- `DIGEST.md` holds sections like Needs you, new, and in progress. It's rewritten when crew state changes.
- The top 5 "Needs you" items show on the Overview.
- The Captain pastes its Needs you section into chat and @-tags you, which notifies like any mention.
- You answer in one line ("merge capy#3780") [M] F:L835-841.

**Where questions come from**
- A crew thread can ask you directly; you answer in that thread [M] F:L839.
- Subagent blockers go to the parent first, which may escalate to you [M] F:L4474.

**Permission gates**
- Personal device: approve each message from elsewhere [M] F:L219, F:L632.
- Run-out card: Wait or Use (owner only) [M] F:L3954.
- Merges: only on your ask [M] F:L2281.
- No plan mode. You ask in the prompt to "write a spec and wait" [M] F:L2251.
- Command-by-command approval for shell commands is not documented [M] RA; I didn't find it in F either [I].

**Where you get notified**
- Web, desktop, a PWA on iOS via Home Screen, Slack, and email-like notifications settings [M] F:L1691, F:L2337.
- Native iOS app: TestFlight beta announced on X on Nov 20, 2026 [M] RA (citing https://x.com/capydotai/status/2123858148339675284, which I did not open). The docs FAQ still says "Is there a mobile app? No." [M] F:L2335-2337.

**Multiplayer**
- Anyone who can see a thread or Captain can write in it or steer it.
- A Captain always acts as its owner, whoever messages it [M] F:L174, F:L867.
- Take over a thread via `POST /threads/{id}/takeover` [M] F:L6956-6958.

---

## 7. UI surfaces

- **Web app and desktop app.** Electron-like desktop with tabs; macOS/Windows/Linux [M] CL 0.2.0, F:L1649-1671. Whether it's actually Electron is [G].
- **Sidebar.** Captains first, then Pinned and folders, then Threads by project. The bottom bar links Threads, Issues, Pull requests, Automations, Explore and Drive [M] F:L4595, F:L4603.
- **Thread pane tabs.** Overview, Diffs, Files, Setup, Browser, Desktop, Shell, PRs, subagents and phones [M] F:L4677-4684.
- **File viewer.** Markdown with Mermaid, CSV/XLSX, HTML sandboxed, images, PDF, video/audio, and 3D/CAD [M] F:L4662-4671.
- **PR page.** `https://capy.ai/pull/<owner>/<repo>/<number>`, with a merge menu [M] F:L4096-4110.
- **Previews.** Ask the agent to expose a port and you get a public URL. Anyone with the URL can open it while the machine is awake; only org members can wake it. Each request keeps the machine awake 5 more min, up to 4 h. Reserved ports: 8090, 8484, 8485, 49983, 61000-61999 [M] F:L3621-3629. The homepage shows the shape `*.preview.capy.ai` (brief, unverified by me today).
- **Cmd+K, shortcuts, themes, Explore, settings map** [M] F:L4637, F:L4701-4719, CL 0.6.0.

---

## 8. Pricing and limits (as of Nov 26, 2026)

**Plans** [M] PR, F:L3661-3666
- Free: own computers only, 100 review credits.
- Lite: $20 (first week $1). 30,000 machine-min, 250 review credits, $20 model usage.
- Pro: $100. 150,000 machine-min, 1,250 review credits, $100 model usage.
- Max: $200. 300,000 machine-min, 2,500 review credits, $200 model usage.
- Enterprise: custom.
- Annual is 20% off. Unlimited members. No rollover.

**Machine minutes** [M] F:L3679-3690
- 1 machine-min = 1 min on 1 vCPU / 4 GB. Large burns 4 per minute.
- So Lite = 7,500 min (125 h) of Large [I], computed from F:L3690.

**What still costs money on a cloud thread**
- Machine time still bills when tokens are on your own subscription [M] F:L3486, F:L2083.
- Reviews always bill Capy credits [M] F:L3982.

**Other limits**
- Drive: 1 / 10 / 25 / 50 GB. Max file 100 MiB. Version history kept 24 h [M] F:L1899-1903.
- Automations: schedule floor 5 min; webhook body 256 KB (first 8,000 chars reach the agent); optional `max_runs_per_day` [M] F:L719, F:L780, F:L787.
- SSO is a $100/mo add-on below Enterprise. BYOC and ZDR on Enterprise request [M] PR.

**Spend controls that exist**
- Auto-reload with a monthly cap [M] F:L47.
- Admin "Never use Capy credits" [M] F:L4001.
- Run-out policy [M] F:L3946.
- Per-thread cost in the title bar; usage by member, model and thread [M] F:L33.
- Usage API [M] F:L5720.
- Plan RAM concurrency cap [M] F:L3490.

**Spend controls I did not find**
- No per-thread, per-Captain or per-automation dollar or token budget that stops work [I]. I grepped F for budget, spend limit and usage limit and found only the items above.
- Captain limits are prompt rules: "give it a rule, such as 'Ask before starting more than two threads at once'" [M] F:L935, FC.

**Possibly stale docs.** On Nov 14, Sulat said docs.capy.ai/pricing still listed a $20 "Capy Pro" and that Lite was "US$20 of credits" [M] research/sulat14.html (https://news.sulat.com/2026/11/14/capy-amp-pricing/). Today's PR shows the machine-minute model, so pricing changed or got clearer around mid-Nov [I].

---

## 9. Security and data handling

**Compliance** [M] F:L124-135, LI, PR
- SOC 2 Type II.
- No training on non-public content without opt-in.
- ZDR for Capy's storage and run-in-your-cloud: Enterprise only.

**Where data lives**
- Threads are stored in Capy's cloud, **including threads on your device**: "anything the agent reads or prints goes into the transcript" [M] F:L124, F:L155, F:L2449.
- Data location: US and wherever subprocessors operate [M] F:L136.

**Retention and deletion**
- Deleted data is restorable. Permanent deletion within 30 days, by email request [M] F:L170.
- No thread export button; use the API [M] F:L2461.

**Secrets**
- Project env vars are encrypted at rest. The agent sees names, not values [M] F:L255.
- **But** output isn't scrubbed; any command can read and print values into the transcript [M] F:L257.
- MCP error redaction is exact-match only, for values of 8+ chars [M] F:L283.

**Other exposures**
- Preview URLs are public while the machine is awake [M] F:L3625.
- An automation webhook URL is the only credential, with no signature [M] F:L770.
- The webhook body is treated as data, "never instructions" [M] F:L783. This is a prompt-level defence against injection [I].

**Visibility**
- New work is visible org-wide by default [M] F:L174.
- The Pulls page shows every member the PRs of every installed repo, private projects included [M] F:L207.

**Telemetry**
- App sends threads, settings, files, errors, perf data and update checks. No third-party analytics in the app [M] F:L269-274.
- PostHog and Sentry were removed from the app on Oct 15, 2026 [M] SP.

**Egress IPs** are not published [M] F:L137.

---

## 10. Features list, marked

This section is the short, marked list. The exhaustive numbered parity inventory (CAPY-001…) is in **§15 Feature checklist (parity)**.

### 10a. Features in mehdi's brief

| Brief feature | Status |
|---|---|
| Long-lived Captains orchestrating hundreds of agents, surfacing only what needs a human | **Verified** as documented [M] F:L802-841. "Hundreds" is a marketing claim [M] FC, LI; not independently verified. |
| Isolated cloud machine per thread | **Verified** [M] F:L3440, F:L3461 |
| Browser and desktop QA | **Verified**: XFCE + Chrome desktop and in-app browser [M] F:L3468, F:L4680-4681. QA quality is unverified. |
| Mobile QA on cloud phones | **Verified** via Revyl, Pro+ [M] F:L1462-1472 |
| PRs that autofix CI failures, review comments, merge conflicts | **Verified** [M] F:L4075, F:L4112-4127 |
| Review agent and guided review | **Verified** [M] F:L4199+, CL 0.4.4 |
| Live preview URLs | **Verified** [M] F:L3619-3631 |
| Threads move between cloud and laptop mid-task | **Verified**, with documented leftovers [M] F:L1703-1732 |
| Shared Drive for rules, skills, files | **Verified** [M] F:L1837-1905 |
| Scheduled and event-triggered automations | **Verified** [M] F:L635-795 |
| Slack, GitHub, Linear, MCP integrations | **Verified** [M] §5 |
| Multiplayer threads | **Verified** [M] F:L174, LI |
| An API | **Verified** [M] F:L5678+ |
| Bring your own subscriptions and keys | **Verified** for tokens only; machine time still bills [M] F:L3653, F:L3974 |
| "Works with every coding agent" | **Capy does not do this.** One native harness plus a Claude Agent SDK path [M] F:L3805, CL 0.5.0, RA |

### 10b. Capy features the brief leaves out

All [M] unless noted:
- **Issues** tracker and board [CL 0.7.0, 0.10.0].
- **Memory** experiment. Scope and retention are not documented [CL 0.3.0; RA].
- **Skills**: repo `.agents/skills`, Drive `skills/` [F:L1875, F:L2383].
- **Plugins** marketplace [F:L2945].
- **OIDC cloud credentials** [F:L1187].
- **Tailscale** [F:L3303].
- **Vercel previews** [F:L3392].
- **Stacked PRs**, including GitHub-native stacks [F:L4133-4145].
- **Side chats and forks** [F:L584-595].
- **Steer/queue/interrupt** delivery modes [F:L4548].
- **Thread takeover** [F:L6956].
- **Thread codes, folders, tags, saved views** [F:L4605-4656].
- **Service users and run-as principals** [F:L117, F:L751].
- **The automation `run_when` gate**: a free fast-model filter [F:L731].
- **Slack bursts** [F:L725].
- **Automation `single` thread mode** [F:L747].
- **Review rules, filters, ignore paths, billing transfer** [F:L9195-9978].
- **Model connection fallback order and run-out policy** [F:L3902-3954].
- **Free-with-ads models** [F:L3789].
- **Fast mode** [F:L3866].
- **Codemode** [CL].
- **Snapshots** and `.capy/setup.json` [F:L1918, F:L2062].
- **Keep awake 4h** [F:L3609].
- **Signed commits via GPG** [F:L2701].
- **Dependency-reader GitHub App** [F:L251].
- **Cloud checkpoints** of local work [F:L155].
- **Import Claude Code/Codex histories** [CL 0.2.0].
- **SSO, passkeys, audit log** [F:L213-215, PR].
- **Sponsored allowance for OSS** [F:L61].
- **Paper integration** [CL 0.4.5].
- **Themes and Explore** [CL 0.6.0].
- **Native iOS app**: TestFlight beta [M RA; unverified by me].

---

## 11. Benchmark baseline: public numbers we could measure Flotilla against

Almost all of these are vendor or customer self-reports, not independent measurements.

| Metric | Public number | Label + source |
|---|---|---|
| **Cost per task / PR** | Not public from Capy. The only usable reference is gstack, where full-depth `/gstack-ship` review "once cost about 50M tokens per PR". That's gstack's own skill running inside Capy, not Capy's review agent. A "$93 paid gate" was also mentioned. One Capy demo session: about 18M input + 32K output tokens over a 24-min span, 174 tool calls, 95 files. | not public (Capy); [M] GS:L174-176, GS:L156; [M] blog gpt-5-5-captain-eval. RA misattributes the 50M figure to "one full-depth review" [M] RA, and the brief repeats that mistake. |
| Cost scale per user | About $100 of cloud machines in 4-5 days (users quoted in a newsletter). Garry Tan replied "I am avging $50K to $100k monthly" under a Capy post, without saying what that covers. | [M] RA (I did not open the newsletter); [M] bsky mirror https://bsky.app/profile/garrytan-mir-rt.selfhosted.social/post/7frpmd5j2pq22. What the $50-100K means is unverified [G: spend]. |
| Machine cost floor | Large $0.40/h. Lite includes 125 h of Large. | [M] F:L3450; [I] from F:L3690 |
| **Autonomous completion rate** | Not public. Closest: "98% of merged PRs built or reviewed by Capy" (Goblins), and 57 of 65 gstack PRs written by Capy threads in the pre-Captain window. | not public; [M] LI (Goblins); [M] GS:L231-232 |
| Throughput | gstack: 197 merged PRs in 14 days vs 65 (3.0x), 194 versions, 1,874 PRs across 8 repos. Median PR shrank from 1,292 to 422 changed lines. Goblins: 5x merged PRs a week, 14,000+ reviews. | [M] GS:L20-32; [M] LI |
| **Time to first PR** | Not public. Proxy: issue-to-fixing-PR merge median 2.4 days (gstack). Open-to-merge median rose from 1.1 h to 5.6 h because of merge trains. CI pickup about 12 s (was about 22 s). | not public; [M] GS:L27-35; [M] CL 0.10.0 |
| Orchestrator latency | GPT-5.5 as Captain: p95 16.8 s, p99 35.4 s per model call. Opus 4.6: 57.7 / 137 s. GPT-5.4: 46.5 / 85.2 s. From 495 sessions and 56,587 calls. | [M] blog gpt-5-5-captain-eval (vendor) |
| **Intervention frequency** | Not public as a rate. Qualitative: Garry answers "in one word, from his phone". "Most Captain wakes used to be 'nothing to report'". "One 'do it' has approved eight plans in a morning." | not public; [M] GS:L192-193, GS:L180-182, GS:L95-96 |
| Context blow-up | One long-lived parent context reached 1.36B tokens | [M] GS:L177 |
| Parallelism | 10-20 subagents "at all times" (Garry). 5-8 lanes on disjoint files (gstack). Plan caps of 8/32/64 Large machines. | [M] bsky mirror; [M] GS:L203-204; [M] F:L3492-3498 |
| **Number of supported engines** | 1 native harness, plus a Claude Agent SDK path for Claude subscriptions. About 65 catalog models. 4 subscription types. 14 gateways/coding plans. 5 key providers. Custom OpenAI-compatible endpoints. | [M] CL 0.5.0, F:L3805; [I] count from F:L3720-3787; [M] F:L3914-3917 |
| **Setup time** | Not public as a number. Docs say "Spend the twenty minutes" on the dev environment. The quickstart has 7 steps, all no-terminal. A reviewer says it takes "some setup". One user called the first run "confusing and over-engineered". | not public; [M] F:L1914; [M] F:L4159-4193; [M] RA |
| Boot / wake time | Not public as a number. "Faster" claims only. | not public; [M] CL 0.10.0 |

---

## 12. Real user complaints (with URLs)

1. **Captains burn subscription limits.** "i tried the captains feature and got my 5h limit claude obliterated in litterally 1h … who tf has the money to run 20 subagents" (@Berrygradient, Oct 2026, quoted in a Garry Tan mirror post) [M] https://bsky.app/profile/garrytan-mir-rt.selfhosted.social/post/7frpmd5j2pq22
2. **Cloud price vs Amp.** @slumdog_8: "The biggest problem with @capydotai is the pricing" ($20 buys about 100 h vs Amp's 750 h). Sulat checked the claim: the prices are right, but the post halves Capy's RAM [M] https://news.sulat.com/2026/11/14/capy-amp-pricing/ (local research/sulat14.html). I did not open the original X post.
3. **Burned money / confusing first run.** "about US$100 on cloud machines in four or five days", "mostly stopped using Capy's cloud", "confusing and over-engineered" [M] RA, quoting a Nov 12, 2026 newsletter by JP Caparas. Unverified at the original.
4. **Not impressed.** "i sometimes toy around with orchestration projects like capy.ai or conductor but haven't really been impressed" [M] https://news.ycombinator.com/item?id=47625490 (local research/hncomments.json).
5. **Data upload without opt-in (allegation).** "auto upload all my agent trajectories to thier aws no consent no opt in … like 12gb … agent traces from claude n codex" (@akashchanran, Oct 17, 2026) [M] that the post exists: https://teapawt.org/akashchanran/status/2111451266467721336. The claim itself is **unverified**; RA found no Capy reply. It may be linked to the desktop app's import of Claude Code/Codex histories [I] CL 0.2.0, F:L2391.
6. **Capy's own admissions**
   - GPT-5.5 "review loop is unusable … keep introducing more issues" (CTO quote). It also delegates bug-finding too early and creeps scope [M] https://capy.ai/blog/gpt-5-5-captain-eval.
   - gstack's notes: 1.36B-token parent context; mostly "nothing to report" wakes; review cost had to be sized to the diff [M] GS:L174-182.
7. **Lost work.** The FAQ covers "Why did I lose my uncommitted changes?" Machines can be rebuilt, and deleted after 14 days asleep [M] F:L2243, F:L3589. That points to a common support issue [I].

Coverage note: the HN Algolia searches turned up almost no capy.ai discussion; there are name collisions with other "Capy" products [M] research/hn.json, hncomments.json, and a live Algolia query today. RA also found no HN, PH or Reddit threads [M] RA.

---

## 13. Gaps: Capy vs Flotilla goals

| Flotilla goal | What Capy does | Gap |
|---|---|---|
| **Self-host with one `docker compose up`** | Closed, hosted SaaS. BYOC only on Enterprise request. | Total [M] F:L135, F:L2441, LI ("don't describe it as open source") |
| **Data stays local** | Transcripts of laptop runs go to Capy's cloud. Cloud checkpoints are on by default. Infrastructure spans about 15+ subprocessors. Deletion means a 30-day email request. | Total [M] F:L124, F:L155, F:L170, SP |
| **No harness lock-in / every agent** | One native harness. Claude only via the Agent SDK. No Claude Code/Codex/Cursor/Gemini CLI/Devin/ACP as engines. GitHub.com only. Export through the API only. | Large [M] F:L3805, CL 0.5.0, RA, F:L2633, F:L2461 |
| **Hard budgets** | Org balance, auto-reload cap, run-out policy, plan RAM cap, automation daily run cap. No per-thread/Captain/run $ or token caps. Captain limits are prompt "rules". | Large [I] F:L47, F:L787, F:L935, F:L3946 |
| **Sandboxed laptop runs** | "Linked folder isn't a sandbox"; runs as your user with your creds | Total [M] F:L225, F:L1833 |
| **User-modifiable orchestrator** | Only through prompt files (AGENTS.md/CREW.md/NOTES.md/skills) and settings. 3 non-overridable rules work like a mini-kernel, but they're prompt-enforced. Drive history is kept for only 24 h. No hooks, no versioned or replay-tested orchestrator changes, no one-click rollback. | Large [M] F:L847-856, F:L231, F:L1903; "no hooks" is [I] from absence in F |
| Region and OS | US East only. Cloud VMs are Linux only. No KVM (Android emulator needs Revyl). No SSH. | [M] F:L3462, F:L2217, F:L3533, F:L3642 |
| Secret hygiene | Output isn't scrubbed. Previews are public by URL. The webhook URL is the only credential. | [M] F:L257, F:L3625, F:L770 |
| Cost transparency for swarms | Per-thread cost is visible, but swarms burn quotas fast (see complaints 1-3) | [I] |

What Flotilla can learn from Capy without copying code [I]:
- Make Captain memory files the source of truth.
- Keep "Needs you" separate from run status, with a typed `ask.kind`.
- Route PR events to the owning thread (the last pusher wins).
- Use an idempotent `requestId` on create calls.
- Expose an SSE stream with run/turn/tool/transcript frames.
- Treat event payloads as untrusted data.
- Keep a hard rule set the user can't override.

---

## 14. Open questions / unverified

1. **Is the native iOS app real?** It's sourced only from RA citing an X post I didn't open. The docs FAQ says no mobile app.
2. **How exactly does Capy use Claude subscriptions** (`claude setup-token` pasted into Capy, run server-side on the Agent SDK)? Does that match Anthropic's terms for third parties? Unverified; Flotilla should not copy it either way.
3. **Hard spend caps.** Is there any per-thread or per-Captain budget that isn't in the docs, or an enterprise-only one? Not found.
4. **The 12 GB "trajectories uploaded" allegation.** Uncorroborated, with no Capy reply found.
5. **Memory (0.3.0 experiment).** Scope, retention and deletion are not documented.
6. **Codemode.** Its exact semantics come from changelog lines only.
7. **Internal stack.** Effect-TS (guess) and Firecracker on Latitude.sh (inferred) are not confirmed by Capy.
8. **Captain internals.** Is the Captain prompt or harness different from a normal thread's, beyond role and files? Not public.
9. **Preview URL shape** `*.preview.capy.ai`: from the brief, not re-checked today.
10. **Benchmark gaps.** Completion rate, time to first PR, intervention rate, setup time and boot time all have no public numbers (§11).
11. **Older product names.** The Feb-Apr 2026 Captain/Build split and the "Scout" name on the YC jobs page vs today's Captains: is the lineage confirmed? Inferred only.
12. **Docs freshness.** Did docs.capy.ai/pricing still show a $20 "Capy Pro" (per Sulat, Nov 14)? Not re-checked; today's pricing page and docs dump agree with each other.
13. **Not done.** Demo and creator video transcripts (Ray Fernando, per RA) and the founders' X accounts were not read directly. X needs login or mirrors.

## 15. Feature checklist (parity)

Owner asks: "also i need every feature from capy in this" and "so better get every feature reversed". This section lists every Capy feature I found in public material, one row each, so Flotilla can track parity row by row. Written Nov 26, 2026 (PKT).

**How to read the rows**
- **Label** uses the same tags as above: `M` measured (Capy's docs, API spec, changelog or marketing say it; I did not test it), `I` inferred, `G` guess.
- **Source** shorthand is the same as at the top, plus three more pages fetched today: `FR` → https://capy.ai/features/review, `FA` → https://capy.ai/features/automations, `SEC` → https://capy.ai/security. `CL 0.x.y` is the release heading on https://capy.ai/changelog. `OA <METHOD> <path>` is an operation in `capy-openapi.json`.
- **Flotilla notes** flag what Flotilla must do differently because of mehdi's decisions:
  - `[TX]` self-hosted transcripts and data (nothing in a vendor cloud)
  - `[BYOM]` BYO machines over SSH/Tailscale, isolated by container or dedicated OS user
  - `[CAP]` runtime-enforced hard token/$ caps that pause and ask the human
  - `[ADP]` any agent via adapters, not one native harness
  - `[NOCLAUDE]` no storing or proxying of Claude session/setup tokens; run the official CLI under the user's own login
  - `n/a` means the row is about Capy's hosted business (billing, compliance) and has no direct Flotilla parity target.
- A feature is listed once. Where the docs and the changelog disagree, the note says so.

### 15a. Count by area

| Area | Rows |
|---|---|
| Threads | 46 |
| Wakes & background | 17 |
| Subagents & forks | 14 |
| Captains | 39 |
| Issues | 9 |
| Pull requests & autofix | 22 |
| Review | 24 |
| Automations | 26 |
| Projects | 7 |
| Environment & snapshots | 15 |
| Cloud machines | 25 |
| Previews | 7 |
| Devices & desktop app | 27 |
| Dock CLI | 11 |
| Cloud phones | 11 |
| Drive | 14 |
| Instructions & rules | 11 |
| Skills | 7 |
| MCP & plugins | 18 |
| Models & connections | 26 |
| Billing & plans | 15 |
| Usage & analytics | 6 |
| Org, members & access | 11 |
| SSO & sign-in | 7 |
| Security & data | 9 |
| Secrets | 7 |
| Cloud credentials (OIDC) | 8 |
| GitHub | 9 |
| Slack | 13 |
| Linear | 6 |
| Other integrations | 5 |
| UI surfaces | 26 |
| Keyboard shortcuts | 5 |
| Notifications | 5 |
| API (platform) | 10 |
| Support | 2 |
| API (endpoints) | 119 |
| **Total** | **639** |

### 15b. Checklist

| ID | Area | Feature (plain words) | Source | Label | Flotilla notes |
|---|---|---|---|---|---|
| CAPY-001 | Threads | Thread = one conversation with one agent about one piece of work, plus its machines, subagents and PRs | F:L4542 | M | [TX] transcript stored in Flotilla's own DB, never a vendor cloud |
| CAPY-002 | Threads | Thread keeps working after you close the tab (agent loop runs server-side) | F:L525, F:L4542 | M | [TX][ADP] Flotilla server owns the loop state; adapters must support detach/resume |
| CAPY-003 | Threads | Start a thread from web app, desktop app, Slack, Linear, API, or @capy on a PR | F:L533, F:L4816-4824 | M |  |
| CAPY-004 | Threads | Steer delivery mode: message reaches agent at its next step (Enter) | F:L4550, F:L568 | M | [ADP] needs adapter 'inject at next step'; fallback = queue |
| CAPY-005 | Threads | Queue delivery mode: message waits until the turn ends (Alt+Enter) | F:L4552, F:L569 | M |  |
| CAPY-006 | Threads | Interrupt delivery mode: stop current generation, read message now (Cmd/Ctrl+Enter) | F:L4551, F:L570 | M | [ADP] adapter cancel+resume (claude --resume, codex exec resume, ACP session/cancel) |
| CAPY-007 | Threads | Remappable send keys, incl. Enter for newline, per browser | F:L572, F:L4554 | M |  |
| CAPY-008 | Threads | Stop run: stops the agent without sending a message; cancels timers and background waits (subagents keep running) | F:L4554, F:L628 | M |  |
| CAPY-009 | Threads | Edit a queued/steered message before the agent reads it; send now / discard / return to composer | F:L4558 | M |  |
| CAPY-010 | Threads | Edit a sent message; thread continues from new version with a version switcher | F:L4560, CL 0.4.0 | M | [ADP] requires fork/rewind support per adapter; else start new session from edited message |
| CAPY-011 | Threads | Dictation (mic) into the composer, auto-accept at 10 min, Undo | F:L4564 | M | [TX] Capy sends audio to ElevenLabs (SP); Flotilla: local or user-chosen STT |
| CAPY-012 | Threads | Attach images/files; they land on the agent's machine | F:L4566 | M |  |
| CAPY-013 | Threads | Thread status: working / waiting / failed / idle (+ archived in API) | F:L4572-4577, OA:ThreadEncoded | M |  |
| CAPY-014 | Threads | 'Needs you' flag, separate from status, with typed ask kinds (conversation, environment, mcp, credits, desktop, feedback, terminal) | F:L4581-4585, OA:ThreadAsk | M | [CAP] add ask kind 'budget' for cap-hit pauses |
| CAPY-015 | Threads | Requests say exactly what is needed (e.g. 'Waiting on you to merge capy#8426'); env-var and desktop requests open inline; dismiss with Undo | CL 0.7.0 | M |  |
| CAPY-016 | Threads | Thread codes (PROJECT-123) usable in Cmd+K and @-mentions | F:L4654-4656 | M |  |
| CAPY-017 | Threads | Auto titles (≤50 chars), rename, regenerate title; org/personal title instructions and 'regenerate when' setting | F:L4688-4695 | M |  |
| CAPY-018 | Threads | Archive (dormant; events become context; message unarchives) / Unarchive without a run / Undo | F:L4623-4633 | M |  |
| CAPY-019 | Threads | Bulk select: archive, tag, file, pin, delete; shift-click range | F:L4629 | M |  |
| CAPY-020 | Threads | Delete a thread (owner-only for private threads) | F:L164 | M | [TX] real hard delete locally |
| CAPY-021 | Threads | Read / unread state, unread mention badge | F:L4591, OA PUT read/unread | M |  |
| CAPY-022 | Threads | Join / leave / subscribe / unsubscribe a thread | OA:/threads/{id}/join\|leave\|subscribe | M |  |
| CAPY-023 | Threads | Take over a thread (become owner/driver) | F:L6956, CL 0.3.0 | M |  |
| CAPY-024 | Threads | Transfer ownership from the share dialog | F:L2121-2123, CL 0.3.0 | M | [NOCLAUDE] owner's connections change; never move a user's vendor login to another user |
| CAPY-025 | Threads | Thread cost shown in the title bar | F:L33 | M | [CAP] show spend vs hard cap live |
| CAPY-026 | Threads | Context meter + 'Compact at' per thread, org default | CL 0.4.6, F:L3968 | M | [ADP] compaction is harness-specific; expose only where adapter supports |
| CAPY-027 | Threads | Agent replies read as sections; Reply to a section quotes it; work between messages folds into one line | CL 0.4.6 | M |  |
| CAPY-028 | Threads | Charts, diagrams and small interactive visuals rendered inline in the thread | CL 0.9.0 | M |  |
| CAPY-029 | Threads | Mermaid diagrams rendered in chat (and posted to Slack as images) | CL 0.5.0, F:L4664 | M |  |
| CAPY-030 | Threads | Comments/annotations on images and videos (pin a spot, box an area) | CL 0.8.0 | M |  |
| CAPY-031 | Threads | Video/audio understanding on Gemini models | CL 0.5.0 | M | [ADP] model-capability flag per adapter |
| CAPY-032 | Threads | Threads without a project (no repo) on This Mac | CL 0.4.4 | M | [BYOM] |
| CAPY-033 | Threads | Message ticks on the left edge to jump to each human message | F:L4641 | M |  |
| CAPY-034 | Threads | Threads hold your reading place when a turn closes | CL 0.9.2 | M |  |
| CAPY-035 | Wakes & background | Turn-based runs; next turn starts on an event | F:L529 | M |  |
| CAPY-036 | Wakes & background | Wake on human message (app, Slack, Linear, API, @capy) | F:L533 | M |  |
| CAPY-037 | Wakes & background | Wake on CI: failing check wakes at once; passes arrive combined | F:L534, F:L4125 | M |  |
| CAPY-038 | Wakes & background | Wake on human reviews/comments; bot feedback ignored by default (bot list) | F:L535, F:L4121 | M |  |
| CAPY-039 | Wakes & background | Wake on merge/conflict if someone wrote in the thread within N days (default 3, configurable) | F:L536, F:L4127, F:L546 | M |  |
| CAPY-040 | Wakes & background | Wake on another agent (subagent done/blocked, message from another thread) | F:L537 | M |  |
| CAPY-041 | Wakes & background | Agent-set timers (up to 7 days) | F:L538, CL 0.3.0 | M | [CAP] timers must respect caps; a cap-paused thread doesn't wake-and-spend |
| CAPY-042 | Wakes & background | Agent-set watches on GitHub event / Slack channel / webhook URL (up to 30 days) | F:L538, CL 0.3.0 | M |  |
| CAPY-043 | Wakes & background | Per-event response setting: React / Keep as context / Ignore; org tab + personal override | F:L542, F:L4116-4123 | M |  |
| CAPY-044 | Wakes & background | Waiting state names the awaited event ('Waiting on api#212 checks') with click-through | F:L550 | M |  |
| CAPY-045 | Wakes & background | Activity bar lists running watches with 'Stop watching' | F:L552 | M |  |
| CAPY-046 | Wakes & background | Long-running background command with explicit timeout (default 30 min, max 6 h) keeps machine awake while waited on | F:L556-558, F:L3601 | M | [CAP] wall-clock + $ cap per command |
| CAPY-047 | Wakes & background | Ask for a plan first: agent writes a spec and stops for go-ahead (no plan mode) | F:L607-615, F:L2251 | M | Flotilla could make plan-gate a first-class Approval |
| CAPY-048 | Wakes & background | Read another thread via @ or code (history, status, PRs, search, save to file) without waking it | F:L599-603 | M |  |
| CAPY-049 | Wakes & background | Message another thread (arrives as steer; reply wakes sender) only when asked | F:L605 | M |  |
| CAPY-050 | Wakes & background | Thread on someone's computer holds incoming messages until owner allows | F:L632 | M | [BYOM] |
| CAPY-051 | Wakes & background | Background file transfers between any two machines | CL 0.3.0, F:L3643 | M | [BYOM] over SSH/rsync |
| CAPY-052 | Subagents & forks | Subagents: full child agents with own conversation/tools, nested up to 3 levels, addressed 'Subagent 1.3' | F:L4433 | M | [ADP] Flotilla spawns child runs via adapters; depth limit in kernel |
| CAPY-053 | Subagents & forks | Subagent starts as editable draft (title + prompt) until started | F:L4435 | M |  |
| CAPY-054 | Subagents & forks | Subagent starts from its prompt alone (no parent history) | F:L4441 | M |  |
| CAPY-055 | Subagents & forks | Shared-machine (read-only work) vs fresh-machine (writers) placement, chosen explicitly | F:L4443-4450 | M | [BYOM] fresh = new container/worktree |
| CAPY-056 | Subagents & forks | Parallel (disjoint files) vs stacked (builds on previous PR branch) subagents | F:L4452-4457 | M |  |
| CAPY-057 | Subagents & forks | Subagent lifecycle draft/working/waiting/idle/done/failed | F:L4461-4467, OA:SubagentEncoded | M |  |
| CAPY-058 | Subagents & forks | Final summary wakes parent; blocked subagent surfaces its question to parent; interim progress read on demand | F:L4469-4475 | M |  |
| CAPY-059 | Subagents & forks | Parent reviews subagent diff, opens PR from its branch, patches, or sends feedback | F:L4477-4479 | M |  |
| CAPY-060 | Subagents & forks | Per-subagent model (cheaper/stronger/connected subscription) | F:L4481-4483, F:L4005 | M | [ADP][CAP] child inherits remaining budget slice, never more |
| CAPY-061 | Subagents & forks | Subagent on a named paired device while parent stays in cloud | CL 0.5.0 | M | [BYOM] |
| CAPY-062 | Subagents & forks | Sibling threads created and messaged by a coordinating agent | F:L4485-4487 | M |  |
| CAPY-063 | Subagents & forks | Side chat: full copy on same machine, opens as a tab, sees uncommitted changes (/side, Cmd+Shift+S) | F:L584, F:L593 | M |  |
| CAPY-064 | Subagents & forks | Fork: full copy (/fork) or summary (/fork-summary) on a fresh machine; 'Fork of …' | F:L585, F:L595 | M | [ADP] fork needs session copy; summary-fork works with any adapter |
| CAPY-065 | Subagents & forks | Select text to fork or side-chat from that passage | F:L589 | M |  |
| CAPY-066 | Captains | Captain: long-lived thread that runs a crew of threads and reports only what needs you | F:L802-806, FC | M | core parity item |
| CAPY-067 | Captains | New Captain dialog: name, face/avatar, project, machine, model, access | F:L810, OA:CreateCaptainRequest | M |  |
| CAPY-068 | Captains | Promote a thread (keeps history, PRs, machine, Slack thread, model, members) | F:L811 | M |  |
| CAPY-069 | Captains | Promote a folder: its threads join the crew, folder removed | F:L812 | M |  |
| CAPY-070 | Captains | Create a Captain by asking any thread ('Make a Captain called Mobile…') | F:L813 | M |  |
| CAPY-071 | Captains | First message = Captain's purpose, written into its rules and plan | F:L815, OA:brief | M |  |
| CAPY-072 | Captains | Demote to thread / Archive (puts crew to sleep) / Unarchive / Delete (crew returns to list) | F:L817-819, F:L2321-2323 | M |  |
| CAPY-073 | Captains | Add existing threads to crew: drag, Move to, threads-page action, folder 'Add to Captain', or ask | F:L823 | M |  |
| CAPY-074 | Captains | Crew rules: same project, not a subagent/Captain, one crew at a time; refusal reasons enumerated | F:L825, OA:CrewRefusal | M |  |
| CAPY-075 | Captains | Captain removes/archives finished crew; release a thread yourself | F:L827 | M |  |
| CAPY-076 | Captains | Crew threads open beside the Captain's chat; Captain hears each crew turn end / need | F:L806, F:L829 | M |  |
| CAPY-077 | Captains | Captain hears when a crew thread answered you directly | CL 0.4.2 | M |  |
| CAPY-078 | Captains | Filter Pull requests page by Captain | F:L831 | M |  |
| CAPY-079 | Captains | Digest: needs you / new / in progress, rewritten on crew state change | F:L835 | M |  |
| CAPY-080 | Captains | Digest tab; top five 'Needs you' on Overview; Needs-you pasted into chat with @-tag notification | F:L837 | M |  |
| CAPY-081 | Captains | Answer digest items in one line ('merge capy#3780'); Captain acts and drops item | F:L839 | M |  |
| CAPY-082 | Captains | Change digest layout by telling the Captain (saved as a rule) | F:L841 | M |  |
| CAPY-083 | Captains | Captain Drive with AGENTS.md, CREW.md, NOTES.md, DIGEST.md, skills/, reports/, renders/, handoffs/ | F:L843-854 | M |  |
| CAPY-084 | Captains | Digest API falls back DIGEST.md → ONGOING.md → NOTES.md, 64 KiB cap | OA:CaptainDigestEncoded | M |  |
| CAPY-085 | Captains | Change rules by telling the Captain; it writes the right file and confirms | F:L856 | M | Flotilla: versioned + replay-tested + rollback (mehdi's orchestrator goal) |
| CAPY-086 | Captains | Captain rereads plan, rules and crew state each wake | F:L2331, FC | M |  |
| CAPY-087 | Captains | Share Captain: everyone at org or specific people; crew access follows Captain; narrowing/widening confirms | F:L858-865 | M |  |
| CAPY-088 | Captains | Captain always acts as its owner (owner's GitHub access and connections) | F:L867 | M | [NOCLAUDE] runs on owner's adapters/logins on owner's machines |
| CAPY-089 | Captains | Owner-only actions: rename, face/alias, Crew runs on, access, transfer, demote, delete | F:L869-873 | M |  |
| CAPY-090 | Captains | Captain takes crew only from its project; one Captain per project for cross-project work | F:L877, F:L2325-2327 | M |  |
| CAPY-091 | Captains | Captain runs in cloud by default and sleeps between turns; can run on a paired device | F:L879-881, CL 0.4.7 | M | [BYOM][CAP] idle Captain wakes cost money — cap Captain wake spend |
| CAPY-092 | Captains | 'Crew runs on' setting: cloud or one paired device; name a machine per thread | F:L883 | M | [BYOM] |
| CAPY-093 | Captains | Steer a Captain from Slack with captain=<name\|alias\|code>, !queue/!steer | F:L887-896 | M |  |
| CAPY-094 | Captains | Captain Alias set in Profile | F:L894 | M |  |
| CAPY-095 | Captains | Captains on a schedule via automations; automations/Slack hand Captain new tickets | F:L900, FC | M |  |
| CAPY-096 | Captains | Captains read and message each other; rule to suppress chatter | F:L936, FC | M |  |
| CAPY-097 | Captains | Limits are prompt rules ('Ask before starting more than two threads at once') | F:L935, FC | M | [CAP] Flotilla enforces fan-out and $ caps in the kernel, not prompts |
| CAPY-098 | Captains | Captains-first / Hybrid sidebar, pinned Captain faces, each row shows the question it waits on | CL 0.9.0, CL 0.9.1 | M |  |
| CAPY-099 | Captains | Captain starts work on a change you mention in passing | CL 0.4.7 | M |  |
| CAPY-100 | Captains | Example Captain setups: Feature, Triage, Janitor | F:L904-928 | M | ship as templates |
| CAPY-101 | Issues | Built-in issue tracker: For you / Assigned / Mentioned views, filters (status, assignee, labels, due date, relations…) | CL 0.7.0 | M |  |
| CAPY-102 | Issues | Issue relations (blocks, relates), sub-issues, labels, due date, linked PRs/threads | CL 0.7.0, OA /issues/{code}/relations\|links | M |  |
| CAPY-103 | Issues | Threads file, update and close issues; owning thread wakes on comments | CL 0.7.0 | M |  |
| CAPY-104 | Issues | Issues board (columns per status, drag, bulk move, undo, keyboard) | CL 0.10.0 | M |  |
| CAPY-105 | Issues | Saved issue views; editable title; reply to/edit comments in place | CL 0.10.0 | M |  |
| CAPY-106 | Issues | Custom issue states (create/order/default), labels, issue prefix | OA /issue-states, /issue-labels, /issue-prefix | M |  |
| CAPY-107 | Issues | Issue comments, timeline, file downloads | OA /issues/{code}/comments\|timeline\|files | M |  |
| CAPY-108 | Pull requests & autofix | Agent commits, pushes and opens PR against the thread's starting branch | F:L4079 | M |  |
| CAPY-109 | Pull requests & autofix | Never pushes to base/default/main/master/develop/release/*; branch named <prefix>/<title> | F:L4081 | M | kernel guard in Flotilla (not prompt) |
| CAPY-110 | Pull requests & autofix | Branch prefix setting ('release' reserved) | F:L4081, F:L2679+ | M |  |
| CAPY-111 | Pull requests & autofix | Open PRs as Ready or Draft (org default + personal override, per-PR by asking) | F:L4085-4090 | M |  |
| CAPY-112 | Pull requests & autofix | 'Open in Capy' button in PR description (toggle) | F:L4088, F:L4094 | M |  |
| CAPY-113 | Pull requests & autofix | Capy PR page at capy.ai/pull/<owner>/<repo>/<n>; Cmd+K by URL/owner/repo#n/title | F:L4096 | M |  |
| CAPY-114 | Pull requests & autofix | Chat with Capy / New thread with PR from the PR page | F:L4098 | M |  |
| CAPY-115 | Pull requests & autofix | Merge menu: squash / merge commit / rebase, comment, Update branch, Enable auto-merge, blocked reason | F:L4102-4104 | M |  |
| CAPY-116 | Pull requests & autofix | Force merge using your GitHub bypass permission | F:L4110 | M |  |
| CAPY-117 | Pull requests & autofix | Merges/comments post as your connected GitHub account (else as Capy) | F:L4108 | M |  |
| CAPY-118 | Pull requests & autofix | Owning thread fixes failing CI, answers reviews, resolves conflicts, wraps up after merge | F:L4075 | M | [CAP] autofix loop guard: attempt cap + $ cap |
| CAPY-119 | Pull requests & autofix | Thread ownership = last thread that pushed; @capy mention assigns owner | F:L4131 | M |  |
| CAPY-120 | Pull requests & autofix | No-CI repos: wake with a note ~30 min after last push | F:L4155 | M |  |
| CAPY-121 | Pull requests & autofix | Stacked PRs (GitHub native stacks or base-branch stacks), stack chip 2/3, merge from bottom | F:L4133-4145, CL 0.4.0 | M |  |
| CAPY-122 | Pull requests & autofix | Fork PRs: check out and review; push own branch instead | F:L4147-4149 | M |  |
| CAPY-123 | Pull requests & autofix | Review button in pull view: summary + comment / request changes / approve as you | CL 0.4.0 | M |  |
| CAPY-124 | Pull requests & autofix | Labels row to edit GitHub labels; Preview chip reads Vercel, Cloudflare and other deploy comments | CL 0.4.7 | M |  |
| CAPY-125 | Pull requests & autofix | Pulls page lists PRs of all installed repos; filters author:/repo:/status:/label:/since: | F:L207, CL 0.4.0 | M |  |
| CAPY-126 | Pull requests & autofix | PR status on idle sidebar rows (Checks / PR failing / PR ready) | F:L4591, CL 0.4.1 | M |  |
| CAPY-127 | Pull requests & autofix | Local PRs on desktop: Diff tab, mark ready/draft, close, reopen, merge | CL 0.2.2 | M | [BYOM] |
| CAPY-128 | Pull requests & autofix | CI pickup ≈12 s | CL 0.10.0 | M |  |
| CAPY-129 | Pull requests & autofix | Agent can read CI logs and re-run jobs (Actions write) | F:L242 | M |  |
| CAPY-130 | Review | Dedicated review agent in a real checkout at the PR's exact head | F:L4203, FR | M | [ADP] review agent = any adapter + review prompt |
| CAPY-131 | Review | Findings: category Bug/Risk/Maintainability/Refactor, severity High/Med/Low, confidence confirmed/investigate, file+line | F:L4209-4224 | M |  |
| CAPY-132 | Review | Notes: anchored observations with no failure | F:L4226 | M |  |
| CAPY-133 | Review | Per-repo automatic mode Off / Once / Every push | F:L4230 | M |  |
| CAPY-134 | Review | Start review from PR page, '@capy review <instructions>', or API | F:L4231-4233 | M |  |
| CAPY-135 | Review | Push during review starts a fresh round | F:L4235 | M |  |
| CAPY-136 | Review | Effort tiers Low/Med/High = 1/5/10 credits; Flex (first Medium, follow-ups Low) | F:L4239, FR | M | [CAP] reviews count against hard caps too |
| CAPY-137 | Review | Reviews never run on your own keys/subscriptions | F:L4239, F:L3982 | M | [ADP] Flotilla: reviews run on any adapter the user picks |
| CAPY-138 | Review | Posting threshold (default medium), toggle investigate findings, opt-in notes | F:L4245 | M |  |
| CAPY-139 | Review | No double-flagging; resolving/irrelevant resolves the GitHub thread | F:L4247 | M |  |
| CAPY-140 | Review | Triage statuses Open/Resolved/Irrelevant; owner thread triages and fixes High before 'ready'; override from dashboard | F:L4251-4259 | M |  |
| CAPY-141 | Review | Incremental re-reviews; irrelevant never re-flagged; failed fix returns as new finding | F:L4263 | M |  |
| CAPY-142 | Review | Review enforces AGENTS.md conventions as findings | F:L4267-4277 | M |  |
| CAPY-143 | Review | Review context page: org review rules + repo files reviews should read, scoped by repo/path | CL 0.3.0, OA /review-rules | M |  |
| CAPY-144 | Review | Review filters and ignore paths | OA /review-filters/* | M |  |
| CAPY-145 | Review | Optional capy/review commit status | F:L241 | M |  |
| CAPY-146 | Review | Review billing transfer between orgs (offer/accept/decline/cancel) | OA /review-billing-transfer/* | M |  |
| CAPY-147 | Review | Visual check: run app, click through, attach screenshots/video to PR; mobile via cloud phone | FR | M |  |
| CAPY-148 | Review | Guided review: overview, steps, before/after diagram, chapter per part with its own diff | CL 0.4.4, FR | M |  |
| CAPY-149 | Review | Guides on big PRs skip lockfiles/generated/deleted files; retries on timeout | CL 0.4.6 | M |  |
| CAPY-150 | Review | Finding lists the rules, memory and production telemetry it rests on | CL 0.5.0 | M |  |
| CAPY-151 | Review | Review machines read-only (can't push); 4 GB default | F:L229, F:L3501 | M | [BYOM] read-only mount in container |
| CAPY-152 | Automations | Automation = stored prompt per project + 1–20 OR'd triggers; each run is a normal thread | F:L639, F:L705 | M |  |
| CAPY-153 | Automations | Manage on Automations page or by asking the agent (full automation tools) | F:L643 | M |  |
| CAPY-154 | Automations | Schedule trigger: 5-field cron + IANA tz, 5-min floor, DST-correct, missed runs coalesce | F:L709, F:L719-721 | M |  |
| CAPY-155 | Automations | GitHub trigger: PR opened/pushed/merged, comments, reviews, labels, checks, branch pushes, workflow_run | F:L710 | M |  |
| CAPY-156 | Automations | Slack trigger: channel messages grouped into bursts (window 1–300 s, 20 msgs, 100 KB) | F:L711, F:L725 | M |  |
| CAPY-157 | Automations | Slack reaction trigger | CL 0.3.0 | M |  |
| CAPY-158 | Automations | Linear triggers: issue created, status changed, cycle ended; team/label filters | CL 0.4.2, FA | M |  |
| CAPY-159 | Automations | Incoming webhook trigger: per-automation secret URL, Idempotency-Key, 256 KB cap, 202 accepted/duplicate/no-match | F:L762-781 | M | Flotilla: add HMAC signature option |
| CAPY-160 | Automations | Webhook batches (collect events into one run): list/flush/cancel | OA /automations/{id}/batches, CL 0.3.0 | M |  |
| CAPY-161 | Automations | On-demand trigger (button, API, agent) | F:L713 | M |  |
| CAPY-162 | Automations | Trigger conditions: repos/branches/authors/labels, channels/authors/text, substring/regex | F:L715 | M |  |
| CAPY-163 | Automations | run_when gate: a free fast-model check of fuzzy conditions | F:L731 | M | [CAP][ADP] gate model must be configurable/free; count toward caps or explicitly exempt |
| CAPY-164 | Automations | Pinned vs unpinned model; pin never silently substitutes | F:L735-740 | M |  |
| CAPY-165 | Automations | Thread mode new vs single standing thread | F:L742-747 | M |  |
| CAPY-166 | Automations | Run in an existing or private thread | CL 0.3.0, CL 0.5.0 | M |  |
| CAPY-167 | Automations | Run-as principal (person or service user), re-verified every run; disabled visibly on offboarding | F:L749-758 | M |  |
| CAPY-168 | Automations | Any project member can run any automation | F:L760 | M |  |
| CAPY-169 | Automations | Webhook body is data, never instructions | F:L783 | M | prompt-injection boundary |
| CAPY-170 | Automations | max_runs_per_day cap; over-cap events recorded as skipped | F:L787 | M | [CAP] plus $/token caps per automation |
| CAPY-171 | Automations | Automation Drive scope (state between runs) | F:L1855-1857, FA | M |  |
| CAPY-172 | Automations | Per-run machine size | FA, OA ModelSelection/machineSize | M |  |
| CAPY-173 | Automations | Pause/resume, delete/restore, trigger, list/cancel runs, rotate webhook via API | F:L647-701, OA /automations/* | M |  |
| CAPY-174 | Automations | Quiet Slack posts; Matching pattern for Slack/webhook triggers; editable description | CL 0.5.0 | M |  |
| CAPY-175 | Automations | Failed run kept with full thread and output | FA | M |  |
| CAPY-176 | Projects | Project = ordered repos with base branches, setup, env vars, automations, integrations, access | F:L4024-4032 | M |  |
| CAPY-177 | Projects | Repoless projects | F:L4032 | M |  |
| CAPY-178 | Projects | Primary vs lazy repositories (lazy clone on demand) | F:L4038-4046 | M |  |
| CAPY-179 | Projects | Auto one-sentence description of each repo from README/manifests | F:L4046 | M |  |
| CAPY-180 | Projects | Identity: name, icon/emoji, uppercase thread code | F:L4054 | M |  |
| CAPY-181 | Projects | New project from GitHub repo, folder on a machine, Git URL, or empty; suggests recently pushed repos | CL 0.4.7, F:L4058 | M | [BYOM] git URL support = other hosts possible in Flotilla |
| CAPY-182 | Projects | Private projects | F:L178, CL 0.4.6 | M |  |
| CAPY-183 | Environment & snapshots | Dev environment per repo: scripts, startup entries, commands, snapshots; versioned shared history | F:L1916-1918 | M |  |
| CAPY-184 | Environment & snapshots | 'Ask Capy to set up' (capy-setup skill) writes and verifies setup on its own machine | F:L1918, F:L4356+ | M |  |
| CAPY-185 | Environment & snapshots | initialize phase (fresh clone; 900 s default) and refresh phase (checkout moved; 300 s); timeouts 60–3600 s | F:L1950-1965 | M |  |
| CAPY-186 | Environment & snapshots | Startup entries: named processes (DBs, dev servers) with readiness port and preview, rerun on wake | F:L1969, CL 0.3.0 | M |  |
| CAPY-187 | Environment & snapshots | Scripts run in bash from repo dir as sudo user with env vars | F:L1982 | M | [BYOM] dedicated user, no sudo on user's laptop by default |
| CAPY-188 | Environment & snapshots | Commands: named on-demand actions (test, build, db reset) | F:L1988 | M |  |
| CAPY-189 | Environment & snapshots | + menu lists Services, Commands, terminals with status dots | F:L1992 | M |  |
| CAPY-190 | Environment & snapshots | Agent can read/replace whole setup via environment tools (with boundaries) | F:L1998 | M |  |
| CAPY-191 | Environment & snapshots | Commit .capy/setup.json to keep setup in the repo | F:L2006 | M | Flotilla: read .capy/setup.json for migration |
| CAPY-192 | Environment & snapshots | Snapshots: post-setup filesystem baked into bootable image; hourly rebuild check | F:L2031-2043 | M | [BYOM] Docker image layers / devcontainer equivalent |
| CAPY-193 | Environment & snapshots | Choose repos in snapshot; disk-budget validation | F:L2054-2056 | M |  |
| CAPY-194 | Environment & snapshots | Snapshot disk tiers 64/128/256 GB; 'also snapshot smaller sizes' | F:L2060-2062 | M |  |
| CAPY-195 | Environment & snapshots | Secrets in builds scrubbed and verified before capture | F:L2064, F:L4321 | M |  |
| CAPY-196 | Environment & snapshots | Snapshot build history with per-step logs; ask why it failed | F:L2068 | M |  |
| CAPY-197 | Environment & snapshots | Setup script failure doesn't block boot; agent repairs | F:L3644 | M |  |
| CAPY-198 | Cloud machines | One isolated Firecracker microVM per cloud thread (own Linux 6.1 kernel) | F:L3440, F:L3461 | M | [BYOM] Flotilla Phase 1: one Docker container per thread; optional microVM later |
| CAPY-199 | Cloud machines | Ubuntu 24.04 x86_64, user with passwordless sudo, repos under /workspace, no swap | F:L3463-3466 | M |  |
| CAPY-200 | Cloud machines | XFCE desktop with Chrome streamed to thread pane | F:L3468 | M |  |
| CAPY-201 | Cloud machines | Sizes Small→Big Guy with plan gating | F:L3446-3455 | M | [CAP] size affects $/h; cap must account |
| CAPY-202 | Cloud machines | Project Machine setting chooses size; Capy can change it | F:L3474 | M |  |
| CAPY-203 | Cloud machines | Billed only while awake + 2-min wind-down | F:L3484 | M | [CAP] |
| CAPY-204 | Cloud machines | Plan limit on concurrent RAM; waits 1 min then 'Cloud machine couldn't start' | F:L3490-3507 | M | [CAP] concurrency cap as a hard budget dimension |
| CAPY-205 | Cloud machines | Service-user API threads use at most half the limit | F:L3503 | M |  |
| CAPY-206 | Cloud machines | Preinstalled toolchain (Node/Python/Go/Rust/Java/Ruby, Docker, k8s tools, DB clients, gh stack…) | F:L3509-3525 | M |  |
| CAPY-207 | Cloud machines | Auto Node version from .nvmrc/.node-version | F:L3527 | M |  |
| CAPY-208 | Cloud machines | Docker + Compose inside VM; local Kubernetes (Kind/Minikube/k3s) with caveats | F:L3529, F:L3548-3572 | M | [BYOM] docker-in-docker needs privileged/sysbox — security tradeoff |
| CAPY-209 | Cloud machines | Kernel limits documented (no /dev/kvm, no modules, listed netfilter gaps) | F:L3531-3546 | M |  |
| CAPY-210 | Cloud machines | Sleep ~2 min after stop unless held awake; disk survives, processes don't; startup entries rerun on wake | F:L3574-3585 | M |  |
| CAPY-211 | Cloud machines | Wake machine button; agent wakes it when needed | F:L3587 | M |  |
| CAPY-212 | Cloud machines | 14-day sleeping machine deletion; rebuild from dev environment if resume fails | F:L3589, CL 0.8.0 | M | Flotilla: warn + auto-push WIP branch before GC |
| CAPY-213 | Cloud machines | Keep awake 4h reservation / cancel | F:L3609-3615 | M | [CAP] |
| CAPY-214 | Cloud machines | Network: public internet; private via Tailscale; OIDC for clouds | F:L3633-3637 | M |  |
| CAPY-215 | Cloud machines | Shell/desktop via + menu, no SSH | F:L3642, F:L4679-4681 | M | [BYOM] Flotilla runners ARE reached over SSH; user can also SSH in |
| CAPY-216 | Cloud machines | Machines don't share filesystems; ask to transfer files | F:L3643 | M |  |
| CAPY-217 | Cloud machines | Machine memory row on Billing page | CL 0.4.3 | M |  |
| CAPY-218 | Cloud machines | OOM stops largest process instead of freezing | CL 0.5.0 | M |  |
| CAPY-219 | Cloud machines | Cloud machines Linux only (macOS/iOS via your Mac) | F:L2217, F:L3641 | M | [BYOM] |
| CAPY-220 | Previews | Expose a port → preview URL; listed under Exposed apps; openable from Slack | F:L3621 | M | Flotilla: preview via reverse proxy/Tailscale Funnel; auth by default |
| CAPY-221 | Previews | Port suggestions in in-app browser; reserved ports | F:L3623 | M |  |
| CAPY-222 | Previews | Anyone with URL can open while awake; only org members can wake | F:L3625 | M | Flotilla default: authenticated previews |
| CAPY-223 | Previews | Each request keeps machine awake 5 more min, up to 4 h; 'Start the machine' link when asleep | F:L3627 | M | [CAP] |
| CAPY-224 | Previews | Stable URL across sleeps; reruns start command if nothing listening | F:L3629 | M |  |
| CAPY-225 | Previews | Portless-style hostname routers supported | F:L3646 | M |  |
| CAPY-226 | Previews | In-machine preview before a PR (machine browser/desktop) | F:L3410 | M |  |
| CAPY-227 | Devices & desktop app | Desktop app macOS (.dmg, Apple Silicon/Intel), Windows x64, Linux x64/arm64 (.deb, AppImage, .tar.gz); self-updates | F:L1649-1671, F:L1736 | M |  |
| CAPY-228 | Devices & desktop app | Sign in with Google, GitHub or email; computer pairs as a device | F:L1651 | M |  |
| CAPY-229 | Devices & desktop app | Machine picker: cloud, another device, or this computer | F:L1675 | M | [BYOM] |
| CAPY-230 | Devices & desktop app | Workspace: New worktree (default) / Existing worktree / Current checkout | F:L1679-1683, CL 0.4.0 | M | [BYOM] worktree inside container/dedicated user |
| CAPY-231 | Devices & desktop app | Scan a folder to link existing clones by remote; Project folders setting | F:L1685 | M |  |
| CAPY-232 | Devices & desktop app | No machine-time charge for local threads | F:L1687 | M |  |
| CAPY-233 | Devices & desktop app | Follow/reply to local threads from any browser incl. phone | F:L1691 | M | [TX] Flotilla web UI served by self-host |
| CAPY-234 | Devices & desktop app | Local thread waits while device asleep/offline up to 24 h | F:L1697 | M |  |
| CAPY-235 | Devices & desktop app | Cloud checkpoints of uncommitted local work (on by default, can turn off) | F:L1699, F:L155 | M | [TX] Flotilla: checkpoints stay on user's infra, opt-in |
| CAPY-236 | Devices & desktop app | Automatic move to cloud when offline device blocks work (toggle) | F:L1699 | M |  |
| CAPY-237 | Devices & desktop app | Continue on / Move to a device / Return to your device (cloud↔device↔device via cloud) | F:L1705, CL 0.9.0, CL 0.4.2 | M | [BYOM] |
| CAPY-238 | Devices & desktop app | What moves (branch, commits, staged/unstaged/untracked, workspace files) vs stays (.gitignored, >2 MB untracked, processes) | F:L1711-1722 | M |  |
| CAPY-239 | Devices & desktop app | Move refused while repo mid-merge/rebase or other threads on machine | F:L1728, F:L1740 | M |  |
| CAPY-240 | Devices & desktop app | Keep awake while agents are running (device setting; Mac lid closed, on power) | F:L1737, CL 0.3.0 | M |  |
| CAPY-241 | Devices & desktop app | System tray keeps device online on Windows/Linux | F:L1738 | M |  |
| CAPY-242 | Devices & desktop app | Device access: Personal (approve each request) / Shared (team + org API keys); Agent access Always allow | F:L219-221 | M | [BYOM] Flotilla shared runners need per-user isolation |
| CAPY-243 | Devices & desktop app | Admins see, rename, revoke every paired device | F:L221 | M |  |
| CAPY-244 | Devices & desktop app | Agent runs as you with your git identity; linked folder is not a sandbox | F:L225 | M | [BYOM] Flotilla must sandbox (container or dedicated OS user) |
| CAPY-245 | Devices & desktop app | Import local Claude Code and Codex histories as threads | CL 0.2.0, F:L2391 | M | [TX][NOCLAUDE] import must be explicit opt-in, local only |
| CAPY-246 | Devices & desktop app | Free models on This Mac with no plan | CL 0.4.2 | M |  |
| CAPY-247 | Devices & desktop app | Desktop: tabs, multiple windows, split panes | CL 0.2.0, CL 0.8.0 | M |  |
| CAPY-248 | Devices & desktop app | Desktop logs stay local; Export logs on crash screen | F:L276, F:L2375 | M |  |
| CAPY-249 | Devices & desktop app | Worktrees under ~/.capy/worktrees need 1 GB free | F:L1741 | M |  |
| CAPY-250 | Dock CLI | capy dock: headless device for Linux/macOS/Windows (servers, VMs, spare Macs) | F:L1748, CL 0.7.0, CL 0.7.2 | M | [BYOM] Flotilla runner agent over SSH/Tailscale instead of outbound pairing |
| CAPY-251 | Dock CLI | Installer: curl\|sh (Linux/macOS) and irm\|iex (Windows); refuses root/admin | F:L1762-1783, INST:L34-36 | M |  |
| CAPY-252 | Dock CLI | Installer verifies sha256 and macOS codesign team; signed-manifest verify | INST:L97-126 | M | Flotilla: signed releases + checksum |
| CAPY-253 | Dock CLI | Installer env/flags: CAPY_DOCK_BASE, CAPY_DOCK_HOME, CAPY_BIN_DIR, CAPY_DOCK_VERSION, CAPY_NO_MODIFY_PATH / --no-modify-path, CAPY_DOCK_ALLOW_ROOT | INST:L4-8, L19-26, L34 | M |  |
| CAPY-254 | Dock CLI | Installs to ~/.capy/dock-install/<version>, symlink ~/.capy/bin/capy, PATH line in shell rc (bash/zsh/fish/profile) | INST:L128-183 | M |  |
| CAPY-255 | Dock CLI | Pairing via link/QR/code approved in Settings → Devices; interactive first run | F:L1793-1802 | M |  |
| CAPY-256 | Dock CLI | --dir to link repo folders; capy dock dirs add/remove | F:L1808-1813, F:L1824 | M |  |
| CAPY-257 | Dock CLI | Runs in foreground; keep alive with tmux/systemd/launchd | F:L1815 | M |  |
| CAPY-258 | Dock CLI | Commands: dock, status, doctor, dirs, verify, version; --verbose | F:L1819-1828 | M |  |
| CAPY-259 | Dock CLI | One device per OS user; recommend dedicated account on shared servers | F:L1832-1833 | M | [BYOM] Flotilla makes dedicated user the default |
| CAPY-260 | Dock CLI | Revoke device; next run re-pairs | F:L1834 | M |  |
| CAPY-261 | Cloud phones | Attach iOS/Android cloud phones to a thread (Revyl); screen only | F:L1462, F:L1506-1522 | M | third-party dependency; Flotilla needs pluggable device provider (Appium/Maestro/emulator) |
| CAPY-262 | Cloud phones | Revyl auto-connects on first use; admin approval if user already has Revyl | F:L1476-1488 | M |  |
| CAPY-263 | Cloud phones | Admins disconnect / toggle Mobile builds and devices | F:L1494-1502 | M |  |
| CAPY-264 | Cloud phones | Device models (iPhone 18 Pro Max…iPad Pro, Pixel 7) | F:L1530-1533 | M |  |
| CAPY-265 | Cloud phones | Mobile builds on Revyl runners (Expo/RN, native iOS, native Android) with build row in chat | F:L1535-1570 | M |  |
| CAPY-266 | Cloud phones | Build limits: queue cancel after 2 h, one infra retry | F:L1573-1580 | M |  |
| CAPY-267 | Cloud phones | iOS runner spec (macOS 26.6.2, Xcode 27.0…) | F:L1584 | M |  |
| CAPY-268 | Cloud phones | Watch/use phone live; Home/Back/Rotate/Open URL toolbar | F:L1586-1594 | M |  |
| CAPY-269 | Cloud phones | Sessions ≤60 min; sleep keeps build, not app data; shared slots; 'Waiting for a phone' | F:L1604-1614 | M | [CAP] phone $/h counts |
| CAPY-270 | Cloud phones | Read app logs (logcat; iOS os_log/NSLog) | F:L1616-1618 | M |  |
| CAPY-271 | Cloud phones | Phone pricing iPhone $5.40/h, Android $3.60/h; Pro+ | F:L1620-1627, PR | M |  |
| CAPY-272 | Drive | Drive scopes: Organization, Personal, Project, Project+personal, Automation, per-Captain | F:L1845-1859 | M | [TX] stored on self-host |
| CAPY-273 | Drive | Drive root AGENTS.md supplies instructions to its scope | F:L1863-1869 | M |  |
| CAPY-274 | Drive | Drive skills at skills/<name>/SKILL.md | F:L1873-1877, F:L4380 | M |  |
| CAPY-275 | Drive | Save/update files by asking; autosave without git commit | F:L1879-1883 | M |  |
| CAPY-276 | Drive | Drive page: browse, edit, upload (32 MB per upload), delete | F:L1885-1891 | M |  |
| CAPY-277 | Drive | Local threads get a copy in ~/.capy/drive/; no background sync | F:L1893 | M | [BYOM] |
| CAPY-278 | Drive | History + Restore (versions kept 24 h) | F:L1895, F:L1903 | M | Flotilla: longer/unbounded history (git-backed?) |
| CAPY-279 | Drive | Storage limits by plan; 100 MiB per file; 'Drive is full' card | F:L1899-1905 | M |  |
| CAPY-280 | Drive | Share links with access setting; Shared view | F:L205, CL 0.4.7 | M |  |
| CAPY-281 | Drive | Edit Drive files in the thread side pane; Markdown outline; concurrent-append merge | CL 0.10.0 | M |  |
| CAPY-282 | Drive | File versions: pick or Compare two | CL 0.6.0 | M |  |
| CAPY-283 | Drive | Fast Drive engine (files appear <1 s on new machine) | CL 0.6.0 | M |  |
| CAPY-284 | Instructions & rules | Global instructions in Personal or Organization drive AGENTS.md | F:L2482 | M |  |
| CAPY-285 | Instructions & rules | Root AGENTS.md, CLAUDE.md fallback; deprecated per-agent files no longer read | F:L2500 | M |  |
| CAPY-286 | Instructions & rules | Nested AGENTS.md injected on first touch of that subtree | F:L2504 | M |  |
| CAPY-287 | Instructions & rules | Glob rules in .capy/rules and .cursor/rules (.md/.mdc, globs/alwaysApply) | F:L2517-2537 | M | [ADP] Flotilla injects rules uniformly for every adapter |
| CAPY-288 | Instructions & rules | Shared context budget; oversized content truncated with visible marker | F:L2515 | M |  |
| CAPY-289 | Instructions & rules | Guidance on what goes where + anti-patterns | F:L2543-2566 | M |  |
| CAPY-290 | Instructions & rules | Migration notes from Claude Code, Cursor, AGENTS.md agents | F:L2618-2622 | M |  |
| CAPY-291 | Instructions & rules | Three non-overridable rules: no merge without ask, no secrets exposure, no fabrication | F:L231, F:L623 | M | Flotilla kernel guards (runtime-enforced where possible) |
| CAPY-292 | Instructions & rules | Context breakdown page: tokens per loaded layer | CL 0.7.0 | M |  |
| CAPY-293 | Instructions & rules | Memory (Experiment): keeps what you teach across threads | CL 0.3.0 | M | scope/retention unverified |
| CAPY-294 | Instructions & rules | Experiments page (Memory, Captain) per user or org | CL 0.3.0 | M |  |
| CAPY-295 | Skills | Invoke skills with $, /, @ (and $name in Slack) or plain words | F:L4342-4352 | M |  |
| CAPY-296 | Skills | Built-in skills: artifact, capy-setup, find-mcp-server, gh-stack, make-a-deck/page/prototype, paper, spreadsheets | F:L4356-4368 | M |  |
| CAPY-297 | Skills | Repository skills in .agents/skills or .claude/skills | F:L4370, F:L2383 | M |  |
| CAPY-298 | Skills | Drive skills and plugin skills | F:L4380-4397 | M |  |
| CAPY-299 | Skills | SKILL.md with name + description frontmatter | F:L4401 | M |  |
| CAPY-300 | Skills | Skills page: Not loaded / Replaced-by markers | CL 0.7.0 | M |  |
| CAPY-301 | Skills | Reuse skills from Claude Code/Cursor and the skills CLI by copying | F:L4378 | M |  |
| CAPY-302 | MCP & plugins | MCP servers: Streamable HTTP (remote) or STDIO (runs on thread machine) | F:L2830, F:L2842 | M | [ADP] pass MCP config to each adapter's native MCP support |
| CAPY-303 | MCP & plugins | Tool-name key prefix per server | F:L2832 | M |  |
| CAPY-304 | MCP & plugins | Owner Organization/Only you; All projects/one project; private overrides org on key clash | F:L2834, F:L2861 | M |  |
| CAPY-305 | MCP & plugins | Auth: OAuth sign-in (auto refresh), API key headers (encrypted), none; variables headers | F:L2836-2840, F:L2887 | M |  |
| CAPY-306 | MCP & plugins | Per-person OAuth (Connection mode: Each member); Private threads only | F:L2872, CL 0.5.0 | M |  |
| CAPY-307 | MCP & plugins | Bring your own OAuth client; documented redirect URI | F:L2893-2901 | M |  |
| CAPY-308 | MCP & plugins | Let Capy set it up (Review card) | F:L2853 | M |  |
| CAPY-309 | MCP & plugins | Import from Claude Code JSON, Codex TOML, URL or command line | F:L2857-2859 | M |  |
| CAPY-310 | MCP & plugins | Statuses, Test button with failing step, 403 checklist | F:L2909-2931 | M |  |
| CAPY-311 | MCP & plugins | MCP error redaction of configured secrets (≥8 chars, exact) | F:L283 | M |  |
| CAPY-312 | MCP & plugins | Plugins = MCP servers + skills; marketplace 'Verified by Capy' | F:L2945-2953 | M |  |
| CAPY-313 | MCP & plugins | Plugin from GitHub repo/folder, manual Sync | F:L2961-2965 | M |  |
| CAPY-314 | MCP & plugins | Plugin keys collected at install, unreadable by members; per-server connect | F:L2957, F:L2967 | M |  |
| CAPY-315 | MCP & plugins | Auto-updates; 'Update needs you' when scopes/keys widen; roll back | F:L2978, F:L2413 | M |  |
| CAPY-316 | MCP & plugins | Build a plugin per Agent Plugins spec 1.0.0/1.1.0 (plugin.json, mcp.json) | F:L2984 | M | Flotilla can consume the same spec |
| CAPY-317 | MCP & plugins | Agent proposes missing plugin in-thread | CL 0.4.4 | M |  |
| CAPY-318 | Models & connections | ~65-model catalog at provider list price; BYOK and ZDR columns | F:L3710-3787 | M | [ADP] Flotilla model choice = adapter + model id |
| CAPY-319 | Models & connections | Default model claude-opus-5-5 | F:L3725 | M |  |
| CAPY-320 | Models & connections | Free-with-ads models (web/desktop only, 6 countries, no ZDR) | F:L3789-3797 | M | probably skip |
| CAPY-321 | Models & connections | Subscriptions: Claude Code (setup-token), Codex/Copilot/SuperGrok (device code); multiple accounts in order | F:L3799-3807, F:L3919 | M | [NOCLAUDE][ADP] Flotilla runs official CLIs signed in on the user's own machine; never stores/proxies tokens |
| CAPY-322 | Models & connections | Claude plan runs on Claude Agent SDK harness | F:L3805, CL 0.5.0 | M | [NOCLAUDE][ADP] use unmodified claude binary via adapter instead |
| CAPY-323 | Models & connections | Azure (organization) models | F:L3801, F:L3862-3863 | M |  |
| CAPY-324 | Models & connections | Fast mode (priority tier) with fallback to standard | F:L3866-3868 | M |  |
| CAPY-325 | Models & connections | Reasoning effort none…max; unsupported fails, no fallback | F:L3896-3898, OA:ModelSelection | M | [ADP] map to each CLI's effort flag |
| CAPY-326 | Models & connections | Modes: fast, pro, ultrafast, daybreak | OA:ModelSelection | M | daybreak semantics unverified |
| CAPY-327 | Models & connections | Connection order: owner → org → Capy credits; reorder, per-connection model list, edit/test/reconnect/disable | F:L3902-3904, CL 0.4.0 | M |  |
| CAPY-328 | Models & connections | Add a connection: searchable provider list (subscriptions, 14 gateways/coding plans, 5 key providers, custom OpenAI-compatible endpoint) | F:L3910-3917, CL 0.7.0 | M |  |
| CAPY-329 | Models & connections | Check access lists models before connecting; exclude models; new models auto-covered | F:L3932 | M |  |
| CAPY-330 | Models & connections | Custom models by id on your key (Find models) | CL 0.4.4, F:L2141 | M |  |
| CAPY-331 | Models & connections | Name a catalog model on one connection (no fallback to credits/other keys) | CL 0.10.0 | M |  |
| CAPY-332 | Models & connections | Model picker badges (subscription/key/credits), tooltip names connection; favorites with ⌥1–9 | F:L3936-3938, CL 0.9.0 | M |  |
| CAPY-333 | Models & connections | Run-out policy Ask me / Ask before credits / Keep going; Wait/Use card; /wait /continue in CLI | F:L3942-3956 | M | [CAP] Flotilla default = pause and ask |
| CAPY-334 | Models & connections | Org settings: members can connect own; members choose run-out; Only <key>; Turn off model; Compact at | F:L3960-3970 | M |  |
| CAPY-335 | Models & connections | Never use Capy credits / exclude a company's models | F:L4001 | M |  |
| CAPY-336 | Models & connections | Model list endpoint | OA GET /api/v1/models | M |  |
| CAPY-337 | Models & connections | Full 1.05M context for GPT-6 on Codex | CL 0.4.3 | M |  |
| CAPY-338 | Models & connections | Background requests (titles, PR summaries) on Capy's ZDR accounts | F:L146 | M | [TX] Flotilla: titles via user's chosen model, local |
| CAPY-339 | Billing & plans | Plans Free/Lite/Pro/Max/Enterprise with machine minutes, review credits, model usage | F:L3657-3673, PR | M | Flotilla is free/self-host; replace with budgets |
| CAPY-340 | Billing & plans | $1 Lite intro week; annual 20% off | F:L3671, PR | M | n/a |
| CAPY-341 | Billing & plans | Machine-minute accounting (1 per 4 GB per minute) | F:L3677-3692 | M | [CAP] Flotilla: cost model per runner type |
| CAPY-342 | Billing & plans | Review credits | F:L3694-3696 | M |  |
| CAPY-343 | Billing & plans | Unlimited members, no seats | F:L3706 | M |  |
| CAPY-344 | Billing & plans | Add balance ($20/$100/$500/other ≥$5) via Stripe; idempotent purchase | F:L37-39 | M | n/a |
| CAPY-345 | Billing & plans | Credit sources breakdown; unlimited grant | F:L41 | M |  |
| CAPY-346 | Billing & plans | Auto-reload with threshold, target and monthly cap | F:L43-49 | M | [CAP] analog: monthly hard cap |
| CAPY-347 | Billing & plans | Billing activity / invoices / receipts | F:L55-57 | M | n/a |
| CAPY-348 | Billing & plans | Sponsored allowance (OSS) with 'Continue on paid credits' switch | F:L59-63 | M | [CAP] same switch semantics for budgets |
| CAPY-349 | Billing & plans | Out-of-credits stop card; doesn't auto-resume | F:L4007-4013 | M | [CAP] Flotilla resumes after human raises cap. Note: CL 0.9.2 says threads now pause and resume when credits arrive — docs and changelog disagree |
| CAPY-350 | Billing & plans | Workspace type Personal/Team | F:L27-29 | M |  |
| CAPY-351 | Billing & plans | Open-source program; YC/solo/ambassador credit programs | capy.ai/llms.txt | M | n/a |
| CAPY-352 | Usage & analytics | Usage page: spend over window, credits vs subscriptions/keys, by member/model/thread, tokens | F:L33 | M | [CAP][TX] local usage ledger |
| CAPY-353 | Usage & analytics | Usage API: report, series (hour/day by member/billing item/thread), balance | F:L5720, OA /usage* | M |  |
| CAPY-354 | Usage & analytics | Private work shown to admins as metadata only | F:L209 | M |  |
| CAPY-355 | Usage & analytics | Activity page: Capy share of merged PRs, review-found issues, contributed PRs, agent hours | CL 0.4.0 | M |  |
| CAPY-356 | Usage & analytics | Per-thread usage totals llm/image/vm/total credits | OA:UsageTotalsEncoded | M |  |
| CAPY-357 | Org, members & access | Roles Owner/Admin/Member; multiple owners | F:L74-84 | M |  |
| CAPY-358 | Org, members & access | Invite by email; revoke pending | F:L86-92 | M |  |
| CAPY-359 | Org, members & access | Join by verified email domain | F:L96-102 | M |  |
| CAPY-360 | Org, members & access | Promote/demote/remove; leave via admin | F:L104-113 | M |  |
| CAPY-361 | Org, members & access | Service users with roles, project access, subscription grants | F:L115-117 | M | [NOCLAUDE] no shared subscription grants for Claude |
| CAPY-362 | Org, members & access | Visibility: shared vs private for projects, threads, Captains, folders; /private, /shared | F:L172-187 | M |  |
| CAPY-363 | Org, members & access | Org sharing settings: Private work toggle, default access, member default | F:L189-191 | M |  |
| CAPY-364 | Org, members & access | Multiple organizations; org switch; create second org | CL 0.4.1, CL 0.4.4 | M |  |
| CAPY-365 | Org, members & access | Delete/restore organization; delete account | F:L162-170, F:L2455 | M | [TX] |
| CAPY-366 | Org, members & access | Work from departed members; transfer thread/Captain/project | F:L2467-2471 | M |  |
| CAPY-367 | Org, members & access | Audit log | PR, SEC | M | details not public |
| CAPY-368 | SSO & sign-in | SSO: Google Workspace OAuth/SAML, Okta, Entra ID, JumpCloud, OneLogin, Keycloak, Auth0, any SAML 2.0 (and OIDC per security page) | F:L286-423, CL 0.9.0, SEC | M | self-host: OIDC/SAML via library |
| CAPY-369 | SSO & sign-in | Domain verification by DNS | F:L304 | M |  |
| CAPY-370 | SSO & sign-in | Require SSO; passkeys after SSO; manage/switch provider | F:L441-503 | M |  |
| CAPY-371 | SSO & sign-in | Two-step sign-in: authenticator app, passkey, recovery codes; on desktop | CL 0.9.1, CL 0.9.2 | M |  |
| CAPY-372 | SSO & sign-in | Org two-step levels incl. Passkeys only | F:L215 | M |  |
| CAPY-373 | SSO & sign-in | SSO $100/mo add-on below Enterprise | F:L297, PR | M | n/a |
| CAPY-374 | Security & data | SOC 2 Type II, DPA, subprocessor notice, 72 h incident notice, no training without opt-in | F:L126-140, SEC | M | n/a for self-host; document Flotilla's own posture |
| CAPY-375 | Security & data | ZDR and run-in-your-cloud on Enterprise | F:L134-135 | M | [TX] default in Flotilla |
| CAPY-376 | Security & data | Threads stored in Capy cloud even for device runs | F:L124, F:L2449 | M | [TX] opposite in Flotilla |
| CAPY-377 | Security & data | No GitHub token on cloud machines (git proxy) | F:L229, SEC | M | [BYOM] Flotilla: short-lived scoped token or proxy |
| CAPY-378 | Security & data | No output scrubbing of secrets | F:L257 | M | Flotilla: redact known secret values in transcripts |
| CAPY-379 | Security & data | Desktop telemetry: no third-party analytics | F:L267-276 | M |  |
| CAPY-380 | Security & data | Secrets encrypted with AWS KMS | SEC | M | self-host: local KMS/age/sops |
| CAPY-381 | Security & data | Egress IPs not published | F:L137 | M |  |
| CAPY-382 | Security & data | Thread export via API only | F:L2459-2461 | M | [TX] Flotilla: native export |
| CAPY-383 | Secrets | Three scopes: Shared (project), Personal, Thread; precedence Thread>Personal>Shared | F:L4288-4296 | M |  |
| CAPY-384 | Secrets | Model sees names and configured-state, never values | F:L4302, F:L255 | M | [ADP] adapters must not echo env into prompts |
| CAPY-385 | Secrets | Values decrypted only when a machine is prepared; written to protected file outside repos | F:L4310 | M |  |
| CAPY-386 | Secrets | Personal values readable by anyone driving a shared thread | F:L4298 | M |  |
| CAPY-387 | Secrets | GitHub tokens never land on a machine | F:L4327 | M |  |
| CAPY-388 | Secrets | Set/list/delete project env vars via API (values write-only) | OA /projects/{id}/environment-variables | M |  |
| CAPY-389 | Secrets | Per-thread write-only env vars on thread create | F:L6792 | M |  |
| CAPY-390 | Cloud credentials (OIDC) | Capy as OIDC issuer per org; issuer URLs in Settings → Cloud credentials | F:L1187, F:L1236 | M | Flotilla self-host can be its own issuer |
| CAPY-391 | Cloud credentials (OIDC) | AWS AssumeRoleWithWebIdentity setup + checks | F:L939-1035 | M |  |
| CAPY-392 | Cloud credentials (OIDC) | Azure federated identity credential | F:L1039-1105 | M |  |
| CAPY-393 | Cloud credentials (OIDC) | Google Cloud Workload Identity Federation + SA impersonation | F:L1107-1185 | M |  |
| CAPY-394 | Cloud credentials (OIDC) | HashiCorp Vault JWT auth | F:L1368-1456 | M |  |
| CAPY-395 | Cloud credentials (OIDC) | Generic OIDC for any service | F:L1313-1366 | M |  |
| CAPY-396 | Cloud credentials (OIDC) | Token claims name org/project/thread; audit logs show thread code | F:L1248, F:L1161, F:L1233 | M |  |
| CAPY-397 | Cloud credentials (OIDC) | Tokens/files at /etc/capy/cloud-access/, 1 h lifetime, refresh; remove project to revoke | F:L1281-1300 | M |  |
| CAPY-398 | GitHub | Capy GitHub App; GitHub.com only | F:L2631-2633 | M | Flotilla: GitHub first, GitLab/Gitea via adapters later |
| CAPY-399 | GitHub | Link many GitHub orgs/accounts; manage installations | F:L2656-2666 | M |  |
| CAPY-400 | GitHub | Connect personal GitHub account to act as you | F:L2643-2647 | M |  |
| CAPY-401 | GitHub | Commit author options (You+Capy co-author default, You, Capy+you, Capy); per-PR override; API pullRequestAuthor | F:L2679-2690, F:L6799 | M |  |
| CAPY-402 | GitHub | Commit email; signed commits with Capy-managed GPG key | F:L2694-2701 | M |  |
| CAPY-403 | GitHub | @capy <message> / @capy review on PRs; 👀 reaction | F:L2708-2720 | M |  |
| CAPY-404 | GitHub | Dependency reader app (read-only private deps) | F:L2725, F:L251 | M |  |
| CAPY-405 | GitHub | App permission set (cannot install with fewer) | F:L233-251 | M | Flotilla: request minimal scopes |
| CAPY-406 | Slack | Install Slack app from Capy settings; org-wide; default project for DMs/channels | F:L3051 | M |  |
| CAPY-407 | Slack | @Capy starts/continues a thread and replies in the Slack thread | F:L3082 | M |  |
| CAPY-408 | Slack | Thread controls: help, aside/!aside, mute/unmute, archive, stop, unlink, !web | F:L3088-3153 | M |  |
| CAPY-409 | Slack | Channel → project mappings | F:L3155 | M |  |
| CAPY-410 | Slack | Directives project/folder/channel/title/model/reasoning/machine/captain | F:L3165-3205, F:L887 | M |  |
| CAPY-411 | Slack | Bang flags !new !web !fast !pro !standard !<effort> !queue !steer | F:L3190-3200 | M |  |
| CAPY-412 | Slack | Personal Slack link; Read Slack as you (read-only) | F:L3067-3070, F:L3212 | M |  |
| CAPY-413 | Slack | PR cards kept live from GitHub; merge from card turns on auto-merge | F:L3216-3225, CL 0.10.0 | M |  |
| CAPY-414 | Slack | Agent Slack tools: read, send (with files), react, list channels, DM you, wait for reactions, edit/delete own messages | F:L3227-3236, CL 0.10.0 | M |  |
| CAPY-415 | Slack | Aside prefix setting | F:L4719 | M |  |
| CAPY-416 | Linear | Linear connection (one workspace per org); personal account link | F:L2748-2752 | M |  |
| CAPY-417 | Linear | Delegate issue → native agent session 1:1 with a thread | F:L2756-2760 | M |  |
| CAPY-418 | Linear | Deterministic project routing; team→project map; default project | F:L2764, F:L2750 | M |  |
| CAPY-419 | Linear | Per-repo default branches for Linear-origin threads | F:L2774 | M |  |
| CAPY-420 | Linear | Posts progress, plan, responses, thread link into the session | F:L2778 | M |  |
| CAPY-421 | Linear | Linear stop signal interrupts the run | F:L2790 | M |  |
| CAPY-422 | Other integrations | Vercel preview detection with best-URL ordering | F:L3396-3404 | M |  |
| CAPY-423 | Other integrations | Tailscale: machines join tailnet as tagged ephemeral nodes via OAuth client; ACLs; disconnect | F:L3303-3373 | M | [BYOM] also the transport for BYO machines in Flotilla |
| CAPY-424 | Other integrations | Paper design files read/edit in threads | CL 0.4.5 | M |  |
| CAPY-425 | Other integrations | Marketplace plugins named publicly: ClickStack, Supermemory, Keiki | CL 0.4.7, CL 0.9.0 | M | full marketplace list not public |
| CAPY-426 | Other integrations | Web search/retrieval (Firecrawl, Exa) | SP | M | [ADP] agent's own web tools |
| CAPY-427 | UI surfaces | Sidebar: Captains, Pinned, folders, Threads by project; Hybrid layout; group by project/folder/none | F:L4595, CL 0.9.1 | M |  |
| CAPY-428 | UI surfaces | Bottom bar: Threads, Issues, Pull requests, Automations, Explore, Drive (reorder/hide) | F:L4603 | M |  |
| CAPY-429 | UI surfaces | Folders (private/shared, no nesting), Pinned, tags (≤20/thread) | F:L4605-4617, F:L4723 | M |  |
| CAPY-430 | UI surfaces | Threads page with filters and saved views | F:L4650-4652 | M |  |
| CAPY-431 | UI surfaces | Cmd+K command menu across threads, PRs, automations, settings; category pills & filters | F:L4637, CL 0.4.0 | M |  |
| CAPY-432 | UI surfaces | Thread pane: Overview, Diffs, Files, Setup, Browser, Desktop, Shell, PRs, subagents, phones tabs | F:L4677-4684 | M |  |
| CAPY-433 | UI surfaces | Tab menu: close others/right/all, reopen closed, middle-click close | CL 0.4.2 | M |  |
| CAPY-434 | UI surfaces | Split panes (split right/down) | CL 0.8.0 | M |  |
| CAPY-435 | UI surfaces | File viewer: Markdown+Mermaid, CSV/XLSX sortable tables, sandboxed HTML, images, PDF, video/audio, 3D/CAD/G-code; Source toggle; 2 MB text cap | F:L4658-4673, CL 0.4.7 | M |  |
| CAPY-436 | UI surfaces | In-app browser (Cmd/Ctrl+Shift+L) and machine Desktop tab | F:L4680-4681 | M |  |
| CAPY-437 | UI surfaces | Appearance: themes (built-in + custom), code font size, scroll-new-messages setting | CL 0.6.0, CL 0.4.3, CL 0.4.4 | M |  |
| CAPY-438 | UI surfaces | Explore (plugins, skills, themes listings) | F:L4603, CL 0.10.0 | M | details not public |
| CAPY-439 | UI surfaces | Settings search and settings map | F:L4710-4719 | M |  |
| CAPY-440 | UI surfaces | Phone browser + Home Screen PWA push | F:L2337, FC | M |  |
| CAPY-441 | UI surfaces | Native iOS app (TestFlight beta) | RA → x.com/capydotai/status/2123858148339675284 | G | unverified; FAQ says no mobile app (F:L2335) |
| CAPY-442 | UI surfaces | Docs site with Markdown twins (.md / ?format=md / Accept header) | capy-llms.txt:L5 | M |  |
| CAPY-443 | Keyboard shortcuts | Cmd/Ctrl+K command menu; Cmd/Ctrl+Shift+O new thread; Cmd/Ctrl+B sidebar; Cmd/Ctrl+Shift+B right pane; Cmd/Ctrl+Shift+G diffs; Cmd/Ctrl+, settings | F:L4701-4708 | M |  |
| CAPY-444 | Keyboard shortcuts | Option/Alt+1–9 jump to thread; Cmd/Ctrl+Option/Alt+Up/Down step | F:L4601 | M |  |
| CAPY-445 | Keyboard shortcuts | Ctrl+Shift+` new shell; Cmd/Ctrl+Shift+S side chat; Cmd/Ctrl+T tab (desktop) | F:L4679, F:L584, F:L4699 | M |  |
| CAPY-446 | Keyboard shortcuts | Thread menu u/a/d; ⇧⌘M comment on message; C to annotate; ⌥1–9 model favorites | CL 0.4.1, CL 0.8.0, CL 0.9.0 | M |  |
| CAPY-447 | Keyboard shortcuts | All shortcuts remappable in Settings → Shortcuts | F:L4699 | M |  |
| CAPY-448 | Notifications | Notification settings: requests and failures, sounds, system alerts, device/push | F:L4585, F:L1691, CL 0.2.2 | M |  |
| CAPY-449 | Notifications | Browser push per device (mentions, failures) even with Capy closed | CL 0.4.2 | M |  |
| CAPY-450 | Notifications | @-mention tags from Captains notify like mentions | F:L837 | M |  |
| CAPY-451 | Notifications | Unread badge on app icon | CL 0.4.4 | M |  |
| CAPY-452 | Notifications | Slack DM from Capy; PR merge/close follow-up sentence | CL 0.10.0, F:L3221 | M |  |
| CAPY-453 | API (platform) | Base https://api.capy.ai/api/v1; Bearer capy_ keys minted only in app; optional expiry; no rotate verb | F:L4883-4890, F:L5688 | M |  |
| CAPY-454 | API (platform) | Keys act as a principal (human or service user); authorId/userId attribution | F:L4892-4899 | M |  |
| CAPY-455 | API (platform) | Idempotent requestId on creates | F:L651, F:L6788 | M |  |
| CAPY-456 | API (platform) | Cursor pagination {items, cursor}; bounded lists return {items} | F:L5727-5732 | M |  |
| CAPY-457 | API (platform) | SSE stream frames status/run/turn/tool_call/assistant/transcript with resume id, retry 2000 | F:L5902-5958 | M | [TX] |
| CAPY-458 | API (platform) | Typed errors capy/* (Unauthorized, Forbidden, RateLimited, PaidFeatureUnavailable, CrewRefused, BillingAuthorityUnavailable…) | F:L6804-6811, F:L7270-7277 | M |  |
| CAPY-459 | API (platform) | Legacy API migration guide (/tasks still served) | F:L5243-5660 | M |  |
| CAPY-460 | API (platform) | Common flows doc (scripts) | F:L4929-5240 | M |  |
| CAPY-461 | API (platform) | Automation webhook endpoint POST /webhooks/automations/{secret} | F:L767 | M |  |
| CAPY-462 | API (platform) | File upload via presigned URLs then attach by fileId | F:L5710 | M |  |
| CAPY-463 | Support | In-app chat (loads only on Contact us) and email support; Slack Connect + 24/7 SLA on Enterprise | F:L4516-4537, F:L276, PR | M | n/a |
| CAPY-464 | Support | Troubleshooting guide (machine replaced, processes gone, setup failed, snapshot failing, credits, Codex reconnect, limits, CI ignored, waits, archived, ports, MCP) | F:L4729-4806 | M |  |
| CAPY-465 | Threads | /plan prefix: explore and ask first, change nothing until plan approved (Slack, Linear, API too) | CL 0.9.0 | M | docs FAQ F:L2251 still says no plan mode; changelog is newer. Flotilla: first-class plan gate |
| CAPY-466 | Threads | /btw opens a side thread like /side; hold Alt+M to talk | CL 0.8.0 | M |  |
| CAPY-467 | Threads | Send while a file is still uploading; goes out after upload, survives reload | CL 0.5.0 | M |  |
| CAPY-468 | Threads | Two or more queued messages fold behind a count above composer | CL 0.4.7 | M |  |
| CAPY-469 | Threads | Retry on provider error with no message to type; error card offers Retry or another model on own key | CL 0.4.7, CL 0.5.0 | M | [ADP] adapter error taxonomy needed |
| CAPY-470 | Threads | Request cards: Later / Dismiss, synced across devices; Captain gathers crew questions with Dismiss all | CL 0.9.0 | M |  |
| CAPY-471 | Threads | capy.ai/new?prompt= deep link pre-fills composer | CL 0.4.7 | M |  |
| CAPY-472 | Threads | Ask Capy to send product feedback; owner approves report before sending | CL 0.4.7 | M | Flotilla: feedback goes to user's own tracker |
| CAPY-473 | Threads | Archive idle threads after N days (skips pinned / open PR); off by default | CL 0.4.7 | M |  |
| CAPY-474 | Threads | Mark all as read (incl. archived) | CL 0.4.4 | M |  |
| CAPY-475 | Threads | Ask cost of a thread → tokens by kind, model and machine | CL 0.9.0 | M | [CAP] |
| CAPY-476 | Threads | Codemode: agent writes programs that call tools; inner tool calls shown live | CL 0.4.4, CL 0.4.7 | M | [ADP] native-engine feature; adapters show inner tool calls if CLI emits them |
| CAPY-477 | Cloud machines | Ask for a bigger machine → thread moves to a fresh one with same repos | CL 0.5.0 | M | [BYOM][CAP] |
| CAPY-478 | Cloud machines | Files tab shows last-turn workspace while machine sleeps (no wake) | CL 0.9.0 | M |  |
| CAPY-479 | Cloud machines | Long commands auto-move to background | CL 0.4.7 | M |  |
| CAPY-480 | Billing & plans | Out of credits: thread pauses (row says model or machine needs credits) and resumes when credits arrive | CL 0.9.2 | M | [CAP] closest Capy analog to Flotilla's pause-and-ask |
| CAPY-481 | Billing & plans | When included usage runs out: switch threads to a free model or use credits (admin setting) | CL 0.9.2 | M | [CAP] Flotilla: never silent downgrade without asking |
| CAPY-482 | Models & connections | Anyone who can see the thread can approve credits; one approval covers a Captain's crew | CL 0.4.7 | M | [CAP] crew-wide approval semantics worth copying |
| CAPY-483 | Models & connections | Default model for Slack mentions and Linear threads + personal default | CL 0.9.0 | M |  |
| CAPY-484 | Models & connections | One row per Claude model; connected Claude subscription runs it first | CL 0.9.1 | M | [NOCLAUDE] |
| CAPY-485 | Models & connections | Change a connection's Base URL | CL 0.4.7 | M |  |
| CAPY-486 | Models & connections | Ads-supported free models extended to UK/AU/NZ/IE | CL 0.10.0 | M |  |
| CAPY-487 | Usage & analytics | By member table ranks by Cost or Tokens; cached tokens not double-counted | CL 0.4.7, CL 0.9.0 | M |  |
| CAPY-488 | Devices & desktop app | Worktree folder setting per device | CL 0.9.2 | M | [BYOM] |
| CAPY-489 | Devices & desktop app | Open files in: choose editor or system default | CL 0.4.7 | M |  |
| CAPY-490 | Devices & desktop app | Thread rows show cloud vs paired device; thread waits for device reconnect | CL 0.4.7, CL 0.5.0 | M |  |
| CAPY-491 | Devices & desktop app | Dock/taskbar unread mentions count | CL 0.4.4 | M |  |
| CAPY-492 | Captains | API: create a thread in a Captain's crew, move threads in/out | CL 0.9.1 | M |  |
| CAPY-493 | Captains | Captain photo upload or org library | CL 0.9.0 | M |  |
| CAPY-494 | Captains | captain= in a Linear mention routes the ask to that Captain | CL 0.8.0 | M |  |
| CAPY-495 | Captains | Large crews / hundreds of subagents render without freezing | CL 0.10.0 | M | Flotilla: virtualized lists |
| CAPY-496 | Issues | Display menu groups/orders issues, hides row properties; comments tag skills/PRs/files | CL 0.8.0 | M |  |
| CAPY-497 | Issues | Click status icon to change status; Capy issue links unfurl in Slack | CL 0.9.0 | M |  |
| CAPY-498 | Review | API reads PR review state and sets finding triage status | CL 0.10.0, OA /reviews/* | M |  |
| CAPY-499 | Review | Stack badge also covers Graphite / spr / manual branch chains | CL 0.8.0 | M |  |
| CAPY-500 | Automations | Several schedules per automation | CL 0.4.7 | M |  |
| CAPY-501 | Automations | Filter automations by project/state/creation date (app, API, thread) | CL 0.8.0 | M |  |
| CAPY-502 | Drive | Drive can grow past 2 GiB up to plan storage | CL 0.8.0 | M |  |
| CAPY-503 | Drive | Drive save/mount failure card explains next step | CL 0.9.0 | M |  |
| CAPY-504 | UI surfaces | Word documents render as pages; Markdown rendered diff with word-level changes | CL 0.9.0 | M |  |
| CAPY-505 | UI surfaces | Audio mode with per-track waveforms and Levels | CL 0.9.2, CL 0.10.0 | M |  |
| CAPY-506 | UI surfaces | Terminals: clickable links, find bar, colored exit line | CL 0.8.0, CL 0.9.0 | M |  |
| CAPY-507 | UI surfaces | Annotate 3D models with pinned notes | CL 0.9.0 | M |  |
| CAPY-508 | UI surfaces | Pages at top setting; collapsible sidebar sections; Customize sidebar | CL 0.9.1, CL 0.4.7 | M |  |
| CAPY-509 | UI surfaces | Preview tabs (close when you move on, double-click to keep) | CL 0.5.0 | M |  |
| CAPY-510 | UI surfaces | Explore: Popular and Recommended for your stack | CL 0.9.1 | M |  |
| CAPY-511 | UI surfaces | Theme follows you across devices; project logo upload | CL 0.4.4, CL 0.8.0 | M |  |
| CAPY-512 | UI surfaces | Onboarding steps that survive reload; joiners skip org setup | CL 0.8.0 | M |  |
| CAPY-513 | UI surfaces | Generated pages/decks/prototypes as single HTML in Capy design | CL 0.4.7, CL 0.8.0 | M |  |
| CAPY-514 | SSO & sign-in | Name/rename passkeys; Security page shows sign-in method; multiple account emails, change primary | CL 0.10.0, CL 0.9.0, CL 0.5.0 | M |  |
| CAPY-515 | Slack | Admins can turn off Link to Capy thread and Post confirmations | CL 0.4.7 | M |  |
| CAPY-516 | Slack | Read Slack as you can read a DM/private channel after per-thread allow | CL 0.5.0 | M |  |
| CAPY-517 | Slack | Slack DM when a thread's PR merges | CL 0.9.0 | M |  |
| CAPY-518 | GitHub | Admins can Unlink a GitHub account in Repository access | CL 0.4.7 | M |  |
| CAPY-519 | MCP & plugins | Thread asks one-click approval to rename/enable/widen an MCP server | CL 0.4.7 | M |  |
| CAPY-520 | MCP & plugins | Connection rows show 'Finish in your browser' with Cancel | CL 0.8.0 | M |  |
| CAPY-521 | API: automations | List batches | OA GET /api/v1/automations/{automationId}/batches | M |  |
| CAPY-522 | API: automations | Flush batch | OA POST /api/v1/automations/{automationId}/batches/{batchId}/flush | M |  |
| CAPY-523 | API: automations | Cancel batch | OA POST /api/v1/automations/{automationId}/batches/{batchId}/cancel | M |  |
| CAPY-524 | API: automations | List automations | OA GET /api/v1/automations | M |  |
| CAPY-525 | API: automations | Create automation | OA POST /api/v1/automations | M |  |
| CAPY-526 | API: automations | Get automation | OA GET /api/v1/automations/{automationId} | M |  |
| CAPY-527 | API: automations | Update automation | OA PATCH /api/v1/automations/{automationId} | M |  |
| CAPY-528 | API: automations | Rotate automation webhook URL | OA POST /api/v1/automations/{automationId}/webhook/rotate | M |  |
| CAPY-529 | API: automations | Trigger automation | OA POST /api/v1/automations/{automationId}/trigger | M |  |
| CAPY-530 | API: automations | List automation runs | OA GET /api/v1/automations/{automationId}/runs | M |  |
| CAPY-531 | API: automations | Cancel automation run | OA POST /api/v1/automations/{automationId}/runs/{runId}/cancel | M |  |
| CAPY-532 | API: automations | Enable automation | OA POST /api/v1/automations/{automationId}/enable | M |  |
| CAPY-533 | API: automations | Disable automation | OA POST /api/v1/automations/{automationId}/disable | M |  |
| CAPY-534 | API: automations | Delete automation | OA POST /api/v1/automations/{automationId}/delete | M |  |
| CAPY-535 | API: automations | Restore automation | OA POST /api/v1/automations/{automationId}/restore | M |  |
| CAPY-536 | API: projects | List projects | OA GET /api/v1/projects | M |  |
| CAPY-537 | API: projects | Get project | OA GET /api/v1/projects/{projectId} | M |  |
| CAPY-538 | API: projects | List environment variables | OA GET /api/v1/projects/{projectId}/environment-variables | M |  |
| CAPY-539 | API: projects | Set environment variables | OA PUT /api/v1/projects/{projectId}/environment-variables | M |  |
| CAPY-540 | API: projects | Delete environment variables | OA DELETE /api/v1/projects/{projectId}/environment-variables | M |  |
| CAPY-541 | API: threads | List threads | OA GET /api/v1/threads | M | [TX] served from Flotilla's own store |
| CAPY-542 | API: threads | Create thread | OA POST /api/v1/threads | M |  |
| CAPY-543 | API: threads | Get thread | OA GET /api/v1/threads/{threadId} | M | [TX] served from Flotilla's own store |
| CAPY-544 | API: threads | Rename thread | OA PATCH /api/v1/threads/{threadId} | M |  |
| CAPY-545 | API: threads | Archive thread | OA POST /api/v1/threads/{threadId}/archive | M |  |
| CAPY-546 | API: threads | Unarchive thread | OA POST /api/v1/threads/{threadId}/unarchive | M |  |
| CAPY-547 | API: threads | Take over thread | OA POST /api/v1/threads/{threadId}/takeover | M |  |
| CAPY-548 | API: threads | Regenerate thread title | OA POST /api/v1/threads/{threadId}/regenerate-title | M |  |
| CAPY-549 | API: threads | Read | OA PUT /api/v1/threads/{threadId}/read | M |  |
| CAPY-550 | API: threads | Unread | OA PUT /api/v1/threads/{threadId}/unread | M |  |
| CAPY-551 | API: threads | Join | OA POST /api/v1/threads/{threadId}/join | M |  |
| CAPY-552 | API: threads | Leave | OA POST /api/v1/threads/{threadId}/leave | M |  |
| CAPY-553 | API: threads | Subscribe | OA POST /api/v1/threads/{threadId}/subscribe | M |  |
| CAPY-554 | API: threads | Unsubscribe | OA POST /api/v1/threads/{threadId}/unsubscribe | M |  |
| CAPY-555 | API: captains | List Captains | OA GET /api/v1/captains | M |  |
| CAPY-556 | API: captains | Create Captain | OA POST /api/v1/captains | M |  |
| CAPY-557 | API: captains | Get Captain | OA GET /api/v1/captains/{captainId} | M |  |
| CAPY-558 | API: captains | List Captain crew | OA GET /api/v1/captains/{captainId}/crew | M |  |
| CAPY-559 | API: captains | Add crew | OA POST /api/v1/captains/{captainId}/crew | M |  |
| CAPY-560 | API: captains | Remove crew | OA DELETE /api/v1/captains/{captainId}/crew/{threadId} | M |  |
| CAPY-561 | API: captains | Get Captain digest | OA GET /api/v1/captains/{captainId}/digest | M |  |
| CAPY-562 | API: folders | List | OA GET /api/v1/folders | M |  |
| CAPY-563 | API: folders | Threads | OA GET /api/v1/folders/{folderId}/threads | M |  |
| CAPY-564 | API: folders | File | OA POST /api/v1/folders/{folderId}/threads | M |  |
| CAPY-565 | API: folders | Unfile | OA DELETE /api/v1/folders/{folderId}/threads | M |  |
| CAPY-566 | API: folders | Pin | OA POST /api/v1/threads/pin | M |  |
| CAPY-567 | API: folders | Unpin | OA POST /api/v1/threads/unpin | M |  |
| CAPY-568 | API: issues | List issues | OA GET /api/v1/issues | M |  |
| CAPY-569 | API: issues | Create issue | OA POST /api/v1/issues | M |  |
| CAPY-570 | API: issues | Get issue | OA GET /api/v1/issues/{code} | M |  |
| CAPY-571 | API: issues | Update issue | OA PATCH /api/v1/issues/{code} | M |  |
| CAPY-572 | API: issues | List issue comments | OA GET /api/v1/issues/{code}/comments | M |  |
| CAPY-573 | API: issues | Comment on issue | OA POST /api/v1/issues/{code}/comments | M |  |
| CAPY-574 | API: issues | List issue timeline | OA GET /api/v1/issues/{code}/timeline | M |  |
| CAPY-575 | API: issues | List issue relations | OA GET /api/v1/issues/{code}/relations | M |  |
| CAPY-576 | API: issues | Relate issues | OA POST /api/v1/issues/{code}/relations | M |  |
| CAPY-577 | API: issues | Remove issue relation | OA DELETE /api/v1/issues/{code}/relations | M |  |
| CAPY-578 | API: issues | Link pull request or thread | OA POST /api/v1/issues/{code}/links | M |  |
| CAPY-579 | API: issues | Unlink pull request or thread | OA DELETE /api/v1/issues/{code}/links | M |  |
| CAPY-580 | API: issues | Download issue file | OA GET /api/v1/issues/{code}/files/{fileId}/download | M |  |
| CAPY-581 | API: issues | List issue states | OA GET /api/v1/issue-states | M |  |
| CAPY-582 | API: issues | Create issue state | OA POST /api/v1/issue-states | M |  |
| CAPY-583 | API: issues | Reorder issue states | OA PUT /api/v1/issue-states/order | M |  |
| CAPY-584 | API: issues | Delete issue state | OA DELETE /api/v1/issue-states/{stateId} | M |  |
| CAPY-585 | API: issues | Update issue state | OA PATCH /api/v1/issue-states/{stateId} | M |  |
| CAPY-586 | API: issues | Set default issue state | OA PUT /api/v1/issue-states/{stateId}/default | M |  |
| CAPY-587 | API: issues | List issue labels | OA GET /api/v1/issue-labels | M |  |
| CAPY-588 | API: issues | Create issue label | OA POST /api/v1/issue-labels | M |  |
| CAPY-589 | API: issues | Delete issue label | OA DELETE /api/v1/issue-labels/{labelId} | M |  |
| CAPY-590 | API: issues | Update issue label | OA PATCH /api/v1/issue-labels/{labelId} | M |  |
| CAPY-591 | API: issues | Get issue prefix | OA GET /api/v1/issue-prefix | M |  |
| CAPY-592 | API: issues | Set issue prefix | OA PUT /api/v1/issue-prefix | M |  |
| CAPY-593 | API: subagents | List subagents | OA GET /api/v1/threads/{threadId}/subagents | M |  |
| CAPY-594 | API: subagents | Get subagent | OA GET /api/v1/subagents/{subagentId} | M |  |
| CAPY-595 | API: subagents | List subagent messages | OA GET /api/v1/subagents/{subagentId}/messages | M |  |
| CAPY-596 | API: tasks | List tasks | OA GET /api/v1/threads/{threadId}/tasks | M | legacy alias; skip unless migrating scripts |
| CAPY-597 | API: tasks | Get task | OA GET /api/v1/tasks/{taskId} | M | legacy alias; skip unless migrating scripts |
| CAPY-598 | API: tasks | List task messages | OA GET /api/v1/tasks/{taskId}/messages | M | legacy alias; skip unless migrating scripts |
| CAPY-599 | API: messages | List thread messages | OA GET /api/v1/threads/{threadId}/messages | M | [TX] served from Flotilla's own store |
| CAPY-600 | API: messages | Send message | OA POST /api/v1/threads/{threadId}/message | M | [TX] served from Flotilla's own store |
| CAPY-601 | API: messages | Versions | OA GET /api/v1/threads/{threadId}/messages/{eventId}/versions | M | [TX] served from Flotilla's own store |
| CAPY-602 | API: messages | Interrupt thread | OA POST /api/v1/threads/{threadId}/interrupt | M | [TX] served from Flotilla's own store |
| CAPY-603 | API: messages | Cancel queued message | OA POST /api/v1/threads/{threadId}/messages/{eventId}/cancel | M | [TX] served from Flotilla's own store |
| CAPY-604 | API: messages | Send queued message now | OA POST /api/v1/threads/{threadId}/messages/{eventId}/send-now | M | [TX] served from Flotilla's own store |
| CAPY-605 | API: files | Upload files | OA POST /api/v1/files | M |  |
| CAPY-606 | API: attachments | List | OA GET /api/v1/threads/{threadId}/attachments | M |  |
| CAPY-607 | API: attachments | Download | OA GET /api/v1/threads/{threadId}/attachments/{fileId}/download | M |  |
| CAPY-608 | API: streams | Stream thread | OA GET /api/v1/threads/{threadId}/stream | M | [TX] served from Flotilla's own store |
| CAPY-609 | API: streams | Stream subagent | OA GET /api/v1/subagents/{subagentId}/stream | M | [TX] served from Flotilla's own store |
| CAPY-610 | API: streams | Stream task | OA GET /api/v1/tasks/{taskId}/stream | M | [TX] served from Flotilla's own store |
| CAPY-611 | API: reviews | Get review settings | OA GET /api/v1/review-settings | M |  |
| CAPY-612 | API: reviews | Configure review settings | OA PUT /api/v1/review-settings | M |  |
| CAPY-613 | API: reviews | Get review billing transfer | OA GET /api/v1/review-billing-transfer | M | n/a for self-host (org billing) |
| CAPY-614 | API: reviews | Offer review billing transfer | OA POST /api/v1/review-billing-transfer/offer | M | n/a for self-host (org billing) |
| CAPY-615 | API: reviews | Accept review billing transfer | OA POST /api/v1/review-billing-transfer/accept | M | n/a for self-host (org billing) |
| CAPY-616 | API: reviews | Cancel review billing transfer | OA POST /api/v1/review-billing-transfer/cancel | M | n/a for self-host (org billing) |
| CAPY-617 | API: reviews | Decline review billing transfer | OA POST /api/v1/review-billing-transfer/decline | M | n/a for self-host (org billing) |
| CAPY-618 | API: reviews | Start review | OA POST /api/v1/reviews | M |  |
| CAPY-619 | API: reviews | Round | OA GET /api/v1/reviews/rounds/{requestId} | M |  |
| CAPY-620 | API: reviews | Pull | OA GET /api/v1/reviews/pulls | M |  |
| CAPY-621 | API: reviews | Update finding statuses | OA POST /api/v1/reviews/findings/status | M |  |
| CAPY-622 | API: reviewRules | Get review rule | OA GET /api/v1/review-rules/{id} | M |  |
| CAPY-623 | API: reviewRules | Delete review rule | OA DELETE /api/v1/review-rules/{id} | M |  |
| CAPY-624 | API: reviewRules | Update review rule | OA PATCH /api/v1/review-rules/{id} | M |  |
| CAPY-625 | API: reviewRules | List review rules | OA GET /api/v1/review-rules | M |  |
| CAPY-626 | API: reviewRules | Create review rule | OA POST /api/v1/review-rules | M |  |
| CAPY-627 | API: reviewFilters | List rules | OA GET /api/v1/review-filters/rules | M |  |
| CAPY-628 | API: reviewFilters | Create rule | OA POST /api/v1/review-filters/rules | M |  |
| CAPY-629 | API: reviewFilters | Delete rule | OA DELETE /api/v1/review-filters/rules/{id} | M |  |
| CAPY-630 | API: reviewFilters | Update rule | OA PATCH /api/v1/review-filters/rules/{id} | M |  |
| CAPY-631 | API: reviewFilters | List ignore paths | OA GET /api/v1/review-filters/ignore-paths | M |  |
| CAPY-632 | API: reviewFilters | Create ignore paths | OA POST /api/v1/review-filters/ignore-paths | M |  |
| CAPY-633 | API: reviewFilters | Delete ignore paths | OA DELETE /api/v1/review-filters/ignore-paths/{id} | M |  |
| CAPY-634 | API: reviewFilters | Update ignore paths | OA PATCH /api/v1/review-filters/ignore-paths/{id} | M |  |
| CAPY-635 | API: usage | Get usage report | OA GET /api/v1/usage | M | [CAP] backed by local spend ledger + caps |
| CAPY-636 | API: usage | Series | OA GET /api/v1/usage/series | M | [CAP] backed by local spend ledger + caps |
| CAPY-637 | API: usage | Balance | OA GET /api/v1/usage/balance | M | [CAP] backed by local spend ledger + caps |
| CAPY-638 | API: users | List organization users | OA GET /api/v1/users | M |  |
| CAPY-639 | API: models | List | OA GET /api/v1/models | M |  |

Rows CAPY-521 to CAPY-639 are generated one per operation from `capy-openapi.json` (all 119 operations under `/api/v1`). Their behavior is covered by the product rows above. They exist so the API parity surface is countable.
### 15c. Coverage note: what I swept, and the gaps

**Swept (Nov 26, 2026 PKT)**
- **docs.capy.ai full dump** (`capy-llms-full.txt`): I went through all 516 headings in the docs part (F:L1–4870), section by section:
  - Account/billing, Security/privacy, Organization, SSO
  - Automations, Captains, Desktop, Dock CLI, Drive, Environment, OIDC (all providers), Cloud phones
  - FAQ, Instructions, GitHub, Linear, MCP, Plugins, Slack, Tailscale, Vercel
  - Machines, Models, Projects, PRs, Review, Secrets, Skills, Subagents, Support, Threads, Troubleshooting
- **API reference** (F:L4872–10152) and **`capy-openapi.json`**: all 119 operations (one row each, 15b) and the key enum schemas (ThreadAsk, CrewRefusal, ModelSelection, statuses). The other ~200 schemas are request/response shapes. They have no rows of their own.
- **Docs index** `capy-llms.txt`: checked page list against the dump. No page is missing from the dump.
- **Changelog**: every release from Beta (Aug 11) to 0.10.0 (Nov 24). I read every `###` feature heading and every "Also in this release" bullet. I skipped "Fixes" lists except where a fix described a behavior.
- **Marketing pages**: pricing (incl. compare table), llm-info, llms.txt, features/captains, features/review, features/automations, security, subprocessors.
- **Dock CLI installer** (`capy-dock-install.sh`): all env vars, the flag, checks and install layout. I read it and did not run it.
- **UI areas**: settings map (F:L4710), shortcuts (F:L4697–4708), notifications, themes/appearance, file viewer, sidebar, Cmd+K.
- **Admin areas**: roles, invites, domains, service users, SSO/2FA/passkeys, audit log (named only).
- **Model catalog**: covered as a feature row (CAPY rows under Models), not one row per model. The ~65 models are in F:L3710–3787.

**Not covered (gaps)**
- The `/integrations/*` marketing pages (GitHub, Slack, Linear, Vercel, Tailscale), `/enterprise`, `/customers`, `/open-source`, `/resources/*`, the `/compare/*` pages and `/use-cases/documentation`. I assumed they repeat the docs. Unverified.
- The changelog "Fixes" bullets were skimmed, not itemized. Small behaviors may hide there.
- Audit log contents, the Memory experiment's internals, the Explore catalog's full list, and the marketplace plugin list are not public beyond names.
- The native iOS app (TestFlight) has one third-party source only. It is labelled G.
- Demo videos (Ray Fernando), X posts and trust.capy.ai (SOC 2 report is gated) were not read.
- Logged-in UI: I didn't sign in, so settings pages that the docs don't describe are missing by design.
- The per-model catalog (prices, BYOK/ZDR flags) is not split into rows. If Flotilla needs model-level parity, expand from F:L3710–3787.


---

## Sources fetched today (Nov 26, 2026 PKT)
- **Docs dump and spec:** https://docs.capy.ai/llms-full.txt (local), https://docs.capy.ai/openapi.json (saved).
- **Capy marketing and blog pages:**
  - https://capy.ai/pricing
  - https://capy.ai/llm-info
  - https://capy.ai/llms.txt
  - https://capy.ai/changelog
  - https://capy.ai/features/captains
  - https://capy.ai/features/review (for §15)
  - https://capy.ai/features/automations (for §15)
  - https://capy.ai/security (for §15)
  - https://capy.ai/subprocessors
  - https://capy.ai/blog/april-2026-update
  - https://capy.ai/blog/gpt-5-5-captain-eval
  - https://capy.ai/blog/captain-vs-build
- **YC:** https://www.ycombinator.com/companies/capy (founders: Nalin Semwal CEO, Justin Sun CTO; team size 6; F24) and /jobs.
- **Installer:** https://downloads.capy.ai/stable/dock/install.sh (saved, not run).
- **Third-party and community:**
  - https://rankagents.app/blog/capy-ai-review
  - the bsky mirror and teapawt pages above
  - HN Algolia API
  - https://github.com/garrytan/gstack/blob/main/capy/README.md
