# GROKBOT-VS-CAPY.md: what makes Grok Bot and Capy Captains good, and what Flotilla should copy

Written Nov 28, 2026 (PKT) for mehdi. Public material only: vendor docs, launch posts, changelogs, one press article, and what I can see in my own tools as a Grok Bot. No logins, no private endpoints, no scraping past what a normal browser fetch returns.

## How to read this

- **[M] measured**: I read it in the cited source today. For vendor pages this means "the vendor says so". It does not mean I tested it.
- **[O] observed**: I can see it in my own Grok Bot tool surface in this session (for example, the approval card I get when Auto-review blocks a command). This is first-hand but only covers what my tools expose.
- **[I] inferred**: my conclusion from cited sources.
- **[G] guess**: plausible, thin evidence.

**Sources (all fetched Nov 28, 2026)**
- `GB:<page>` = `https://docs.x.ai/grok-bot/<page>` (the official Grok Bot docs; raw `.md` copies saved in `research/fresh/grokbot/`). Pages read: overview, get-started, use-cases, how-grok-bot-works, bots, chat-and-collaboration, files-and-results, computer-and-apps, skills-routines-and-automations, approvals-security-and-privacy, vault, team-bots, create-a-team-bot, mobile, microsoft-teams, meetings, initiative, tag-on-x, teams-and-enterprises, deployment, identity-and-access, okta-fastpass, private-networks, proxies, computers, inference-hooks, security, security-faq, settings-and-notifications, deep-links, troubleshooting, faq.
- `GBN:beta` = https://x.ai/news/introducing-grok-bot (Aug 11, 2026). `GBN:1.0` = https://x.ai/news/grok-bot-1-0 (Nov 11, 2026). `GBN:plans` = https://x.ai/news/grok-bot-more-plans.
- `FCR` = https://forum.cursor.com/t/introducing-grok-bot/168053 (Cursor forum launch post). `VB` = VentureBeat, Aug 11, 2026: https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month
- `FC` = https://capy.ai/features/captains (re-fetched today). `CL` = https://capy.ai/changelog (re-fetched; newest entry is 0.10.0, Nov 24, 2026). `F:Lnnn` = docs.capy.ai/llms-full.txt line (re-fetched today; byte-identical to the Nov 26 copy, so nothing new in the docs). `CAPY-nnn` = row in `research/CAPY.md` §15. Blog: https://capy.ai/blog/april-2026-update, https://capy.ai/blog/captain-vs-build, https://capy.ai/blog/gpt-5-5-captain-eval.
- `FLO` = Flotilla repo `flotilla/p1` at `287ef25` (Nov 28, 2026), read-only. "PARITY" = `docs/plan/PARITY.md` status at that commit.

---

## 1. The short version

- **Capy Captains** are an engineering manager. One long-lived agent splits a goal into many coding threads, each on its own machine with its own branch and PR, reads every report, and tells you only what needs you. Memory is files it rereads every wake. Strength: fan-out, PR follow-through, digest. Weak spots: limits are prompt rules, not code; computer use is a streamed XFCE desktop inside each thread, not a personal persistent computer [M] FC, F:L802-941, CAPY-097.
- **Grok Bot** is a personal teammate with its own computer. One persistent cloud computer per user (Firecracker microVM) with a browser, terminal and files that keep logins between tasks. It signs in using Vault, a password manager or a Secure Form without seeing the values, and hands you the screen for SSO, passkeys, CAPTCHAs and QR codes. Every risky action passes an independent review model (Auto Review) and shows an approval card. It remembers you, saves skills, runs routines, and works from desktop, iOS, Slack, Teams, X and meetings [M] GB:computer-and-apps, GB:vault, GB:approvals-security-and-privacy, GB:teams-and-enterprises.
- **What mehdi loves** (his words: good with its own computer, trustworthy research, lets him log in on its screen, fast) maps to Grok Bot features Capy mostly lacks: the persistent personal computer, the takeover flow, the review layer, evidence-first reports and memory. Those are the **SHIP NOW** list (§4). Everything that is a big new surface (channels, mobile, voice, meetings, marketplace) is **LATER UPDATES** (§5), per mehdi's v1 rule.

---

## 2. Capy Captains: every public behavior, and what our research missed

CAPY.md already has 39 Captain rows (CAPY-066..100) plus the related rows below. I re-read the Captains page, changelog and blog today. **The docs are unchanged since Nov 26.** The changelog's newest entry (0.10.0, Nov 24) was already covered.

### 2a. Captain behaviors (all [M] unless marked)

| Area | Behavior | Source | CAPY row | Flotilla (PARITY) |
|---|---|---|---|---|
| Identity | Long-lived thread that runs a crew of threads and reports only what needs you | F:L802-806, FC | 066 | done |
| Create | Dialog (name, face, project, machine, model, access); promote a thread or a folder; ask any thread to make one | F:L810-813 | 067-070 | 067/068 done; 069, 070 blocked (unblock-10/11) |
| Purpose | First message becomes its rules and plan | F:L815 | 071 | done |
| Lifecycle | Demote, archive (crew sleeps), unarchive, delete | F:L817-819 | 072 | blocked (unblock-11) |
| Crew | Add threads by drag, Move to, or asking; same project, one crew at a time, refusal reasons | F:L823-825 | 073-074 | done |
| Crew | Captain archives finished crew; you can release a thread | F:L827 | 075 | done |
| Crew | Hears each crew turn end or need; crew opens beside the Captain chat | F:L806, F:L829 | 076 | blocked (unblock-11) |
| Crew | Hears when a crew thread answered you directly; still hears merges while waiting on you | CL 0.4.2, CL 0.9.x | 077 | blocked (unblock-11) |
| Crew | Crew questions gathered in one menu with Dismiss all | CL (Nov 15 entry) | 466 (cards) | done (cards) |
| Scale | "Hundreds of threads", any machine, any model, model per thread or Captain picks | FC, F:L810 | 163-ish | partial (maxConcurrentCrew 5 in kernel) |
| Digest | Needs you / New / In progress, rewritten on change; top 5 on Overview; @-tag notifies | F:L835-837 | 079-080 | done |
| Digest | Answer in one line ("merge web#136") and it acts and drops the item | F:L839, FC | 081 | done |
| Memory | Drive files AGENTS.md, CREW.md, NOTES.md, DIGEST.md, skills/, reports/, renders/, handoffs/; rereads every wake | F:L843-854, F:L2331 | 083-086 | done |
| Rules | "From now on run e2e before calling a PR ready": Captain writes the rule and every crew thread follows it | FC "Rules every thread reads" | 085 | done (rule write); crew propagation unverified |
| Sharing | Share with org or people; always acts as owner; owner-only actions | F:L858-873 | 087-089 | done |
| Placement | Cloud by default, sleeps between turns, can run on a paired device; "Crew runs on" | F:L879-883, CL 0.4.7 | 091-092 | blocked (device plane, unblock-33/34) |
| Steering | Slack `captain=<name>`, `!queue`/`!steer`, alias; phone browser + PWA push | F:L887-896, FC | 093-094, 440 | 094 done; 093, 440 blocked |
| Schedules | Captain sets up its own automation ("every weekday 9am…"); automations/Slack hand it tickets | F:L900, FC | 095 | blocked (unblock-11) |
| Teamwork | Captains read and message each other; rule to suppress chatter; hand work to a teammate's Captain | F:L936, FC | 096 | done |
| Limits | Limits are prompt rules ("Ask before starting more than two threads") | F:L935 | 097 | done, and Flotilla enforces in the kernel |
| Sidebar | Captains-first sidebar, pinned faces, row shows the question it waits on | CL 0.9.0-0.9.1 | 098 | done |
| Initiative | Starts work on a change you mention in passing | CL 0.4.7 | 099 | blocked (unblock-11) |
| Templates | Feature, Triage, Janitor setups | F:L904-928 | 100 | done |
| Tracking | Work lands as issues with owner and status | FC "Tracked as issues" | 101-107 | partial (issues API done, web in unblock-06/07) |
| Needs you | Typed asks incl. **desktop** ("Waiting on you to use the desktop", Open desktop, Done) | F:L4581-4587, CL 0.7.0 | 014-015 | done as a card; the desktop itself is missing (409) |
| Computer | XFCE + Chrome desktop streamed to the thread pane; in-app browser; watch the machine's desktop live | F:L3412, F:L3468, F:L4680 | 200, 215, 436 | blocked (unblock-38) |
| QA | Visual check: run app, click through, attach screenshots/video | FR | 147 | blocked (unblock-32) |
| Research | "Send a question, not a ticket": threads dig in, Captain returns a written report with no code | FC "Captains beyond code" | none (new) | missing |
| Research | Web search/retrieval connectors (Firecrawl, Exa) | CL | 426 | blocked (unblock-25) |
| Memory | Memory experiment keeps what you teach across threads | CL 0.3.0 | 293 | done (explicit teach, 50 newest) |
| Safety | Three non-overridable rules: no merge without ask, no secret exposure, no fabrication | F (rules page) | 291 | done |
| Model | Capy's eval: GPT-5.5 viable as Captain but its review-fix loops "do not converge"; Opus default in April | blog gpt-5-5-captain-eval | n/a | informs the autofix cap |

### 2b. What CAPY.md missed (new rows to add, all [M] FC unless noted)

1. **Captains beyond code** use cases: research reports with no code, a daily scorecard ("score CI health, flag anything out of band, start a thread to fix it"), changelogs posted after each merge wave, and support-bug intake ("take every bug report from #support, reproduce, file issues"). These are templates on top of research + routines, not new primitives.
2. **Rule propagation to crew**: a rule the Captain writes is read by every crew thread. CAPY-085 covers writing the rule, not that crew threads must read it.
3. **Crew open-questions menu with Dismiss all** (CL, Nov 15): a Captain gathers crew questions in one place.
4. **Captain keeps hearing merges while it waits on you** (CL 0.9.x).
5. **Captain can become a thread again** and run on a paired device while sending crew to any device (CL 0.4.7). Covered in pieces by 072/091, worth one explicit test.

None of these change the plan much. The big gap is not in Capy coverage. It is that Capy itself is weak at the things mehdi named (personal computer, login takeover, trustworthy research), and Grok Bot is strong at them.

---

## 3. Grok Bot: every public feature

Grouped by area. All [M] from the cited doc page unless marked [O] (my own tool surface) or [I].

### 3a. Computer and browser
- One persistent cloud computer per user with browser, command line and files. Logins, cookies and files persist between tasks. Work continues with your laptop closed. GB:computer-and-apps
- Each Bot gets **its own screen** on the shared computer, so several Bots use browsers in parallel. One computer-use task per screen at a time. Screens are work surfaces, not security boundaries. GB:computer-and-apps
- Per-user isolation is a dedicated Firecracker microVM with its own kernel. Within one user, all Bots share cookies, files and CLI credentials. GB:teams-and-enterprises
- **Watch** the computer live from the chat's right panel (clicks, typing, navigation, status). GB:computer-and-apps
- Uses connectors/MCP where they exist and computer use everywhere else, "so work lands in the real tool, not a draft". FCR
- Update, Recover and Reset the computer; backups before update. GB:computer-and-apps
- Route the computer's web traffic through your own desktop (sites see your IP); private/VPN destinations blocked unless allowed. GB:settings-and-notifications
- Optional commands on your **local** computer with per-command approval (Ask every time by default). GB:approvals-security-and-privacy
- Bots search and read X. GB:computer-and-apps
- [O] The computer is a full Linux box: installing tools, running code, generating files. Agents share the machine but each has its own desktop, and files move between the box and the user's computers with explicit copy tools.

### 3b. Sign-in and human takeover
- Sign-in order: Vault login, then a connected password manager (1Password), then a **Secure Form** in chat. Values are filled into the page **without the model seeing them**. GB:vault
- OTP codes are read from a connected Gmail/Outlook or the Bot's own inbox. GB:vault
- **Take over**: for SSO, passkeys, CAPTCHAs, approvals on another device, QR codes, bank card checks or "human required" sites, the Bot hands you the computer. You choose Take over (or Take control), do only that step, choose **I'm done**, and the Bot continues. The session stays for later tasks. GB:vault, GB:computer-and-apps
- When a site expires a session or re-verifies, the Bot pauses and notifies you instead of working around the check. GB:computer-and-apps
- New sign-ups: Vault generates the password and the Bot never sees it. GB:vault
- Secrets (API keys) via a masked secure-secret card, write-only: you can't read a saved value back. GB:vault
- [O] My own sign-in skill requires the in-chat secure form or a hand-over of the box desktop before any login page, and forbids pasting passwords in chat.

### 3c. Trust and safety
- **Auto Review**: an independent review model checks each action before it runs (shell commands, app calls, computer use, routine/trigger writes, Cloud Agent and subagent launches). It lets the action run, asks you, or denies. GB:security
- Approval card shows the operation and inputs. **Allow once / Always allow (saves a rule) / Deny** (no retry until your next message). Warnings like "This can't be undone". GB:approvals-security-and-privacy
- Custom rules in plain words: up to 20 Ask first + 20 Allow automatically; Ask first wins; admins can enforce. GB:approvals-security-and-privacy
- Cards from chat wait forever; cards from background work expire after 30 minutes. GB:approvals-security-and-privacy
- Auto Review counts only **your own messages** as the request; text from emails or web pages doesn't count. GB:approvals-security-and-privacy
- **Prompt injection**: outside content is marked as untrusted data; controls that don't depend on a model (network policy, per-action approvals, isolation) sit underneath. GB:security
- [O] In my tools, every tool result arrives wrapped in untrusted-data fences, and an Auto-review block comes with a same-action retry that raises an approval card to the user.
- Email from the Bot's own address that you didn't ask for in chat always waits as a draft; outgoing messages are drafts by default. GB:chat-and-collaboration, GB:approvals-security-and-privacy
- Network policy modes (allow all, blocklist, defaults + allowlist, allowlist only), static egress IPs, TLS-inspecting proxies, private networks via Tailscale/Cloudflare. GB:security, GB:private-networks, GB:proxies
- Inference hooks: your own server screens what reaches the model, with verdicts, timeouts and a circuit breaker. GB:inference-hooks
- Audit logs (admin/security events) and Action Recording (scrubbed Bot actions, 90 days, OTel export), Enterprise. GB:security

### 3d. Output quality and evidence
- Ask for a **reviewable result**: document with source links, spreadsheet, deck, folder of screenshots and logs, unsent draft, recommendation + evidence. GB:files-and-results
- For consequential work, separate **facts from source systems / assumptions / actions done / actions waiting for approval / open questions**. GB:files-and-results
- **Preserve evidence**: direct source links, screenshots with the state visible, timestamps and time zones, file names, a concise action log, and an explicit list of what it could not verify. GB:files-and-results
- Revise the same artifact instead of making copies. GB:files-and-results
- **Pages**: reports, dashboards and trackers with tables, charts and controls, kept in a Library, shareable, updatable from routines. GB:files-and-results
- Images and short videos on request. GB:files-and-results
- Coding work is delegated to Cursor Cloud Agents, and their screenshots/videos come back as attachments. GB:files-and-results
- "Only come back when something needs your approval." GBN:beta
- [O] My own rules: label claims measured/inferred/guess, cite URLs, prove it works before saying done, and only surface what needs the human.

### 3e. Memory and skills
- Each Bot keeps preferences, rules you give it, facts about you and a **dated work log**. Name and time zone are shared by all your Bots. GB:bots
- The Bot decides what to save; you can ask it to remember, correct or forget. No memory screen for personal Bots. GB:bots
- "Memory is not a source of truth": re-check changing numbers, cite or reopen data for decisions. GB:bots
- Logins, cards and contact info go to Vault, never memory. GB:bots
- Import memory from another assistant. GB:bots
- **Skills**: reusable instructions with when to use, inputs and access, steps, **how to validate**, what to return, and **what needs approval**. Private skills are shared across your Bots. GB:skills-routines-and-automations
- **Teach a task**: record up to 10 minutes of your browser workflow; the Bot drafts a skill you review and test. GB:skills-routines-and-automations
- Start with one task, make it reliable, save as a skill, only then automate. GB:skills-routines-and-automations

### 3f. Speed and parallel work
- Many Bots in parallel, each on its own screen; a "chief of staff" Bot over specialist Bots. GBN:beta
- Bots message each other asynchronously; the receiver wakes, works and replies. One owner per stage to avoid duplicate work. GB:chat-and-collaboration
- Group chats where Bots coordinate and pull you in for judgment calls. GB:chat-and-collaboration
- 1.0: "faster and more reliable at using the browser", "reduced resources", "fewer interruptions", better at knowing when you already authorized an action. GBN:1.0
- [O] I can launch background subagents for parallel work and await them, and run long shell jobs in the background.

### 3g. Routines, triggers and initiative
- Routines run a workflow on a schedule or on an event: Slack message, GitHub, Linear, Sentry, PagerDuty, email, webhook. Plain-words schedules in your time zone; Test runs one now. GB:skills-routines-and-automations
- **Initiative**: the primary Bot offers to take on work, flags apps that signed you out, follows up on dropped threads. It offers first and asks before risky actions. GB:initiative, GBN:1.0

### 3h. Channels and surfaces
- Desktop (macOS, Windows, Linux) and iOS/Android apps; the apps are thin clients for chat, review and approvals. GB:teams-and-enterprises, VB
- Mobile: Siri, Shortcuts, Live Activities; approve cards from the phone; let a Bot use phone apps (calendar, contacts, location, alarms). GB:mobile
- Voice: dictation, voice memos, voice chat that remembers earlier calls. GB:chat-and-collaboration
- Phone calls on your behalf; shopping and hotel booking flows. GB:chat-and-collaboration
- Slack (Team Bots get their own Slack app), Microsoft Teams, X Chat, tag @bot on X. GB:team-bots, GB:microsoft-teams, GB:tag-on-x
- Meetings: joins Meet/Zoom/Teams, takes notes, answers in meeting chat, sends summary and action items, longer report as a page. GB:meetings
- Bot email address: receive mail, read OTP codes, trigger routines, send with approval. GB:computer-and-apps
- Attention states: Needs attention, Unread, Working. GB:settings-and-notifications
- Deep links to start a message or add a plugin. GB:deep-links

### 3i. Teams and admin
- Team Bots shared with people or groups; private per-member chats; owner/Managers approve what the Bot learns; Allow Shared Logins; Slack workspace access. GB:team-bots, GB:teams-and-enterprises
- Admin controls: Cloud Agent delegation, template sharing, Network Controls, Team Setup Scripts, Team Secrets, sudo, Action Recording, enforced Auto Review and rules, Admin API. GB:teams-and-enterprises
- Marketplace of prebuilt Bots (dr eggbot sets up a team of Bots, tinkabot wraps an API into an MCP plugin), templates. GB:overview, GB:how-grok-bot-works
- Pricing: separate Bot usage, included in SuperGrok and Cursor Pro+ plans. GBN:plans, VB

---

## 4. Feature matrix

Legend: ✅ has it, ◐ partial, ✗ missing, n/p not public. Tag `PARITY` = a Capy row Flotilla must match; `BEYOND-nnn` = Grok Bot feature Capy lacks (new Flotilla row). Bucket: **NOW** = SHIP NOW (v1, built by DEVIN-GOAL-CAPTAIN.md); **L#n** = LATER UPDATES rank n (§6).

| # | Feature | Capy | Grok Bot | Flotilla today (FLO, measured) | Tag | Bucket |
|---|---|---|---|---|---|---|
| 1 | Long-lived orchestrator with crew, digest, only-needs-you | ✅ | ◐ chief-of-staff Bot over specialists | ✅ Captain + 5 MCP tools, scheduler | PARITY 066-086 | done |
| 2 | Persistent personal computer whose browser logins survive runs | ✗ per-thread machine; browser profile persistence n/p | ✅ | ✗ thread image has no browser (`deploy/thread.Dockerfile`) | BEYOND-001 | NOW |
| 3 | Agent drives the browser (snapshot + screenshot + click/type) | ◐ desktop with Chrome inside the thread | ✅ | ✗ no computer tools in `captain/tools/service.ts` | BEYOND-002 | NOW |
| 4 | Watch the agent's screen live in the UI | ✅ desktop pane | ✅ | ✗ desktop route returns 409 (`routes/machine-core.route.ts:42`) | PARITY 200/215/436 + BEYOND-003 | NOW (live view) |
| 5 | Human takeover for login/2FA/captcha, then hand back | ◐ "use the desktop" ask | ✅ Take over / I'm done | ◐ desktop ask card exists (`thread-composer/store.ts:27`), no screen | BEYOND-003 | NOW |
| 6 | Agent never sees the password; session stays in the sandbox | n/p | ✅ | ✗ | BEYOND-004 | NOW |
| 7 | Web search + fetch tools | ◐ Firecrawl/Exa connectors | ✅ [I] (browser + research) | ✗ (CAPY-426 blocked) | PARITY 426 + BEYOND-005 | NOW |
| 8 | Cited reports with labels and an automatic citation check | ✗ | ◐ guidance: source links, unverified list | ✗ | BEYOND-006 | NOW |
| 9 | Done only with evidence (tests, screenshots, links); facts/inferences/done/waiting/unverified report | ◐ PR + CI | ✅ guidance + evidence | ◐ autofix loop guard, plan gate; no evidence gate | BEYOND-007 | NOW |
| 10 | Agent-written memory with work log, per-agent + shared facts | ◐ files + Memory experiment | ✅ | ◐ explicit `POST /memory`, 50 newest (`rules/store.ts:66-90`) | PARITY 293 + BEYOND-008 | NOW |
| 11 | Save a successful run as a skill, reuse by name | ◐ skills exist, agent capture n/p | ✅ | ◐ skills discovery/mount (`skills/`), no capture tool | BEYOND-009 | NOW |
| 12 | Approval cards before send/publish/purchase/delete, with rules | ◐ merge approvals, plan gate | ✅ Auto Review + rules | ◐ approvals table, budget/merge/plan gates only | BEYOND-010 | NOW |
| 13 | Untrusted-content fencing in prompts and tool results | n/p | ✅ | ◐ events carry `trust`; no fence wrapper found by grep | BEYOND-011 | NOW |
| 14 | Audit log of agent actions | ◐ org audit log (Enterprise) | ✅ Action Recording (Enterprise) | ◐ only Captain-sharing audit (migration 0048) | BEYOND-012 | NOW |
| 15 | Speed: warm computer, snapshot-first browsing, caching, parallel crews, cheap model for routine steps | ◐ faster boots (0.10.0), model per thread | ✅ | ◐ subagents parallel/stacked; heartbeat backoff; no warm computer | BEYOND-013 | NOW |
| 16 | Built-in playbook: plan → act → verify, cite, ask for takeover | n/p | ✅ [O] | ✗ | BEYOND-014 | NOW |
| 17 | Measured quality (eval scorecard) | ◐ vendor model evals | n/p | ✗ | BEYOND-015 | NOW |
| 18 | Vault + Secure Forms (fill logins/cards without the model seeing) | ✗ | ✅ | ✗ (secrets vault for env vars only) | BEYOND-101 | L1 |
| 19 | Routines: skill on a schedule or event, Captain sets it up | ✅ automations | ✅ | ◐ automations core done; Captain hand-off blocked (095) | PARITY 095 + BEYOND-102 | L2 |
| 20 | Model-based action reviewer on top of rules | ✗ | ✅ Auto Review | ✗ | BEYOND-103 | L3 |
| 21 | Agent's own email inbox (OTP codes, mail triggers, drafts) | ✗ | ✅ | ✗ | BEYOND-104 | L4 |
| 22 | Pages: live reports/dashboards in a library | ◐ make-a-page skill | ✅ | ✗ | BEYOND-105 | L5 |
| 23 | Teach by demonstration | ✗ | ✅ | ✗ | BEYOND-106 | L6 |
| 24 | Initiative: offers work, flags signed-out apps, follows up | ◐ mention in passing (099) | ✅ | ✗ (099 blocked) | PARITY 099 + BEYOND-107 | L7 |
| 25 | Phone approvals and push | ✅ PWA push | ✅ native apps | ✗ (440/449 in unblock-22) | PARITY 440/449 | L8 |
| 26 | Captains talk in a group chat, single owner per step | ◐ messages + suppress rule | ✅ | ◐ 096 done | BEYOND-108 | L9 |
| 27 | Password manager connect (1Password/Bitwarden) | ✗ | ✅ 1Password | ✗ | BEYOND-109 | L10 |
| 28 | Slack / Teams / Telegram channel to a Captain | ✅ Slack captain= | ✅ Slack, Teams, X | ✗ (093 in unblock-40) | PARITY 093 + BEYOND-110 | L11 |
| 29 | Connector catalog + "wrap an API as MCP" helper | ✅ marketplace | ✅ marketplace, tinkabot | ◐ MCP servers done | BEYOND-111 | L12 |
| 30 | Route browser traffic through your own machine (home IP) | ✗ (Tailscale for private nets) | ✅ | ✗ | BEYOND-112 | L13 |
| 31 | Run commands on your own laptop with per-command approval | ✅ paired devices | ✅ | ✗ (device plane in unblock-33..36) | PARITY 228-260 | L14 |
| 32 | Full desktop for non-browser apps (XFCE, LibreOffice) | ✅ | ✅ | ✗ (unblock-38) | PARITY 200 | L15 |
| 33 | Captain templates beyond code: daily scorecard, changelog post, support intake | ✅ | ✅ use-case Bots | ◐ templates 100 done | BEYOND-113 | L16 |
| 34 | Voice: dictation, voice memos, voice chat | ◐ dictation (011) | ✅ | ✗ (011 in unblock-30) | BEYOND-114 | L17 |
| 35 | Image/video generation | ✗ | ✅ | ✗ | BEYOND-115 | L18 |
| 36 | Meetings bot (join, notes, summary) | ✗ | ✅ | ✗ | BEYOND-116 | L19 |
| 37 | Memory import from another assistant | ✗ | ✅ | ✗ | BEYOND-117 | L20 |
| 38 | Inference hooks (your server screens model input) | ✗ | ✅ Enterprise | ✗ | BEYOND-118 | L21 |
| 39 | Team/shared bots that learn with owner approval | ✅ shared Captains | ✅ Team Bots | ✅ sharing done (087) | BEYOND-119 | L22 |
| 40 | Prebuilt bot marketplace / templates sharing | ✅ Explore | ✅ | ◐ | BEYOND-120 | L23 |
| 41 | Shopping, booking and payment wallets | ✗ | ✅ | ✗ | BEYOND-121 | L24 |
| 42 | Phone calls on your behalf | ✗ | ✅ | ✗ | BEYOND-122 | L25 |
| 43 | Native mobile apps, Siri, phone-app control | ◐ PWA | ✅ | ✗ | BEYOND-123 | L26 |
| 44 | X integration (tag @bot, X Chat, read X) | ✗ | ✅ | ✗ | BEYOND-124 | L27 |
| 45 | Enterprise network modes, static IPs, TLS proxies, Admin API | ◐ | ✅ | ◐ egress gate with allowlist + private-IP block (`apps/gate/src/policy.ts`) | BEYOND-125 | L28 |

---

## 5. SHIP NOW (v1 core quality, built by DEVIN-GOAL-CAPTAIN.md)

In plain words, these make a Captain feel like Grok Bot at its best: it has its own browser that stays logged in, you can sign in on its screen yourself, its research comes with checked sources, it proves work before saying done, it remembers you, it's fast, and it asks before anything risky.

| ID | What it is (plain words) | Proof the run must produce |
|---|---|---|
| BEYOND-001 | **Own computer.** Each user gets one persistent browser computer (Chromium on a virtual screen) whose logins and cookies survive between runs. It sleeps when idle and wakes in seconds. | Log in once on a mock site, restart the container, still logged in |
| BEYOND-002 | **Computer-use tools.** Captains and granted crew threads can look at the page (text snapshot first, screenshot when needed), click, type, scroll, press keys, go to URLs, through Flotilla's own tool proxy. Each run gets its own tab ("screen"). | Fake agent completes a mock form flow through the tools |
| BEYOND-003 | **Watch + take over.** A live view of the agent's screen in the web UI. When the agent hits a login, 2FA or captcha it raises an orange "Needs you: sign in to X" card. You take control, the agent is locked out, you finish, press I'm done, it continues. | Agent's tool calls get "human in control" during takeover and resume after |
| BEYOND-004 | **Password never seen.** Your keystrokes go straight to the browser and are never stored, logged or shown to the agent. Cookies stay inside your computer's volume. The server never reads the browser profile. Cookie-export calls are blocked. Only your own runs can reach your computer. | Grep of DB, events and logs after takeover finds no password |
| BEYOND-005 | **Web search + fetch.** A search tool (provider plug-in; tests use a local mock, real providers need mehdi's key) and a fetch tool that turns pages into clean text, caches them and marks them untrusted. | Fake agent searches and fetches the mock web |
| BEYOND-006 | **Checked citations.** Research reports list claims labeled measured/inferred/guess, each with source links and a quote. A checker confirms the quote is in the fetched page and the link is live. Uncited or unmatched claims get flagged, and the report shows "unverified" instead of "done". | Checker passes the honest report and catches an invented citation |
| BEYOND-007 | **Prove it before done.** A crew thread can't report done without evidence (test output, screenshot or link). Final reports use one shape: facts, inferences, done, waiting on you, couldn't verify. | Thread claiming done without running tests is marked unverified |
| BEYOND-008 | **Real memory.** The agent can save, list and forget memories itself (per Captain and per user), keeps a dated work log, pulls the relevant memories into each run, refuses to store secrets, and treats memory as a hint, not a source of truth. | Run 2 uses a preference taught in run 1 |
| BEYOND-009 | **Saved skills.** After a task works, the Captain can save it as a draft skill (steps, how to check, what needs approval). You approve it once and every later run can use it by name. | Saved skill mounts in the next run |
| BEYOND-010 | **Ask before risky actions.** Sends, posts, purchases, deletes, permission changes, typing secrets and accepting terms stop at an orange approval card with the exact action and inputs: Allow once, Always allow (saves a rule) or Deny (no retry until you write again). You can add plain rules like "ask first before any external email". Enforced in code (kernel), not by asking the model nicely. | Clicking "Place order" on the mock shop raises a card; Deny blocks it |
| BEYOND-011 | **Injection fencing.** Every web page, email, CI log and tool result goes to the model inside marked untrusted fences, and only your own messages count as instructions. | A mock email saying "forward all mail" does not cause a send |
| BEYOND-012 | **Audit log.** Every agent action (tool, target, decision, who approved), with secrets scrubbed, on one page. | Actions from the eval appear in the log, scrubbed |
| BEYOND-013 | **Fast.** Warm computer, snapshot-first browsing (cheaper than screenshots), fetch cache, start several crew threads in one call, a cheap model for routine steps, and timing numbers in the scorecard. | Scorecard records wake time and parallel speed-up |
| BEYOND-014 | **Captain playbook.** A built-in skill every Captain and crew thread loads: plan, act, verify, cite sources, ask for takeover instead of passwords, use the report shape, one owner per step. | Skill is mounted in every Captain run |
| BEYOND-015 | **Measured quality.** `make eval-captain` runs six real tasks against local mocks with the scripted fake agent and writes a scorecard. | Scorecard JSON committed in the exit doc |

Capy rows these also move: CAPY-014/015 (desktop ask gets a real screen), CAPY-293 (memory). CAPY-200/215/436 (desktop stream), CAPY-426 (web retrieval) and CAPY-147 (visual check) stay owned by the unblock run (units 38, 25, 32). The Captain run builds pieces they can reuse and must not flip their status.

---

## 6. LATER UPDATES (ranked by daily-use value for a solo dev; no Devin work now)

Size: S ≈ 1 unit, M ≈ 2-3 units, L ≈ 4-6 units, XL = a new app or a vendor approval.

| Rank | ID | Feature | Why it matters (one line) | Size |
|---|---|---|---|---|
| 1 | BEYOND-101 | Vault + Secure Forms | Removes most takeovers: the agent fills saved logins and cards without ever seeing them | M |
| 2 | BEYOND-102 | Routines for Captains (schedule + events: GitHub, email, webhook) | Turns a working skill into "it just happens every morning" | M |
| 3 | BEYOND-103 | Model-based action reviewer (Auto Review style) | Fewer pointless cards and smarter blocks than fixed rules alone | M |
| 4 | BEYOND-104 | Captain's own email inbox | Reads OTP codes itself and lets mail start work; needs a mail domain | M |
| 5 | BEYOND-105 | Pages (live reports/dashboards) | Research and scorecards you can reopen and that stay updated | M |
| 6 | BEYOND-106 | Teach by demonstration | Show it once in the browser instead of writing steps | M-L |
| 7 | BEYOND-107 | Initiative and follow-ups | It notices dropped threads and signed-out sites without being asked | M |
| 8 | PARITY 440/449 | Phone approvals + push (PWA) | Approve cards from your phone; mostly in unblock-22 already | S-M |
| 9 | BEYOND-108 | Captain group chat with single owner per step | Captains coordinate without you relaying | M |
| 10 | BEYOND-109 | Password manager connect | Fewer secrets to re-enter; depends on Vault | S-M |
| 11 | BEYOND-110 | Slack/Telegram/Teams channel to a Captain | Talk to it where you already are; Slack parity is in unblock-39..42 | L |
| 12 | BEYOND-111 | Connector catalog + "wrap an API as MCP" | Structured access beats clicking for common apps | L |
| 13 | BEYOND-112 | Route browser traffic through your machine | Sites that block datacenter IPs start working | M |
| 14 | PARITY 228-260 | Commands on your own laptop with approval | Device plane is in unblock-33..36 | (unblock) |
| 15 | PARITY 200 | Full desktop for non-browser apps | Only needed for GUI apps; unblock-38 owns it | (unblock) |
| 16 | BEYOND-113 | Beyond-code Captain templates (daily scorecard, changelog, support intake) | Cheap once routines exist | S |
| 17 | BEYOND-114 | Voice (dictation, memos, voice chat) | Nice on the go, not core | M-L |
| 18 | BEYOND-115 | Image/video generation | Occasional use; provider keys | S |
| 19 | BEYOND-116 | Meetings bot | Notes and actions from calls; vendor bot rules | L |
| 20 | BEYOND-117 | Memory import from another assistant | One-time convenience | S |
| 21 | BEYOND-118 | Inference hooks | Enterprise DLP; little solo value | M |
| 22 | BEYOND-119 | Team bots that learn with owner approval | Team feature | L |
| 23 | BEYOND-120 | Bot/Captain template marketplace | Sharing setups | M |
| 24 | BEYOND-121 | Shopping, booking, payment wallets | High risk, needs Vault + reviewer first | L |
| 25 | BEYOND-122 | Phone calls on your behalf | Telephony vendor, consent rules | L |
| 26 | BEYOND-123 | Native mobile apps, Siri, phone-app control | New app per platform | XL |
| 27 | BEYOND-124 | X integration | Niche | S-M |
| 28 | BEYOND-125 | Enterprise network modes, static IPs, TLS proxies, Admin API | Enterprise only | M |

---


### Separate track: Devin CLI adapter (not SHIP NOW, not LATER)
A standalone, off-by-default PR (`DEVIN-PR-DEVIN-CLI.md`) adds the official `devin` CLI as a crew adapter (`FLOTILLA_ADAPTER_DEVIN_CLI=1`). It is neither a Capy nor a Grok Bot feature. Why separate: Cognition's free SWE-2.1 window ends Dec 8, 2026 PT (SWE-2 Nov 30) [M] cognition.com/blog/swe-2-1. After that it uses mehdi's paid quota. The platform terms also restrict use to build competing products (clause iii) and allow Authorized Users only (clause iv) [M] cognition.com/legal/platform-terms-of-service. So mehdi decides when to flip it on. Size: S.

## 7. Unverified and open

- Grok Bot internals beyond the docs (how screens are implemented, which streaming protocol, which model Auto Review uses) are not public. I did not guess them into the design; Flotilla's design is its own.
- Capy's browser-profile persistence across thread machines is not documented [I: probably per machine, lost when the machine is replaced].
- "Hundreds of threads" (Capy) and "faster, fewer resources" (Grok Bot 1.0) are vendor claims without public numbers.
- I could not watch demo videos; transcripts were not available as text, so video-only behavior is not covered.
- No public X posts were read for this pass beyond those already cited in CAPY.md.
