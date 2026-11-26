# FIRSTMATE.md: firstmate, deep-read (step 2)

Source: https://github.com/kunchenguid/firstmate (MIT). Local copy: `research/firstmate/`, shallow clone (50 commits), HEAD `9931328` (2026-11-26 09:14 -0800 = 22:14 PKT).
Written Nov 26, 2026 (PKT). Read-only analysis: nothing installed, nothing pushed. Three of firstmate's own test files were run offline (see §10).

## How to read this

- **[M] measured**: I read it in the code/docs or fetched it. **[I] inferred**: my reading of measured facts. **[G] guess**: plausible, no direct evidence.
- File refs are `path:line` relative to `research/firstmate/` unless they start with `CAPY.md` (= `research/CAPY.md`, step 1).
- `GH-API` = https://api.github.com/repos/kunchenguid/firstmate (fetched Nov 26, 2026).

---

## 0. The short version

Plain words: firstmate is a folder of instructions and bash scripts. You open Claude Code (or Codex, Grok, Pi…) inside it, and that agent becomes the "first mate": it spawns other coding-agent CLIs in tmux windows, each in its own git worktree, watches them with a zero-token bash loop, and only wakes up to tell you about PRs, decisions and failures. **You** are the "captain".

- It is an "agent distro", not an app: `AGENTS.md` + skills + `bin/` scripts that any terminal agent follows [M] README.md:36-40, VISION.md:60.
- Orchestrator = an LLM session (the primary harness). Mechanics = ~148k lines of bash [M] (§1). Judgment vs mechanics split is a stated principle [M] VISION.md:32-35.
- Drives 19 agent CLIs, including Devin, Claude Code, Codex, Cursor CLI, Gemini CLI [M] AGENTS.md:92.
- Isolation is **git worktrees only**; workers run with permission bypass flags by default, with no container or OS sandbox [M] (§6).
- Budgets are **not** enforced as $ or token caps; cost is "a courtesy… never block on it" [M] AGENTS.md:365 (§7).
- "Capy's Captains came from firstmate": **not supported**. Capy used "Captain" 4 months before firstmate existed, the roles are inverted, and no file names match. A conceptual influence on Capy's Sep 2026 crew redesign is possible but is a **guess** (§9).

---

## 1. Language, stack, license, maturity

| Item | Value | Label + source |
|---|---|---|
| License | MIT, "Copyright (c) 2026 Kun Chen" | [M] LICENSE:1-3, GH-API `license.spdx_id=MIT` |
| Created / first commit | Repo created 2026-06-12 03:21 UTC (08:21 PKT); initial commit authored 2026-06-11 07:49 UTC (12:49 PKT), 15 files incl. `AGENTS.md`, `bin/fm-spawn.sh`, `bin/fm-watch.sh` | [M] GH-API `created_at`; https://api.github.com/repos/kunchenguid/firstmate/commits/ccdea30b8c89e5725695e35c54b414e5b3509b5d |
| Activity | Last push 2026-11-26 17:14 UTC (22:14 PKT). ~1,215 commits on main (API pagination). PR numbers reach #8773 [M] `git log` | [M] GH-API `pushed_at`; commits `Link: …page=1215` |
| People | 175 contributors incl. anonymous (API pagination); 26 watchers | [M] GH-API contributors `Link: …page=175`, `subscribers_count` |
| Popularity | 9,155 stars, 2,812 forks | [M] GH-API |
| Issues/PRs | 902 open issues, 2,019 open PRs, 1,203 merged PRs | [M] GitHub search API (type:issue state:open / type:pr state:open / type:pr is:merged) |
| Main language | Shell (GitHub). Tracked non-test lines: sh 147,710; md 30,331; ts 12,429; py 6,768; mjs 5,538. Tests: 303,046 lines, 346 `*.test.sh` files | [M] `git ls-files … \| wc -l` |
| Scripts | 263 entries in `bin/`, 10 runtime backends in `bin/backends/` | [M] `ls bin`, bin/fm-backend.sh:103 |
| Platforms | macOS, Linux | [M] README.md:4 |
| Required tools | node, git, gh (+`gh auth login`), no-mistakes ≥1.46.0, gh-axi, chrome-devtools-axi, tasks-axi, quota-axi; plus per backend e.g. tmux + treehouse | [M] docs/configuration.md:2436-2472 |
| Sister projects (same author) | `treehouse` (worktrees), `no-mistakes` (validation pipeline) | [M] README.md:46, AGENTS.md:229-237. Their licenses: **unverified** |

Maturity reading: very active and widely used, but huge (300k test lines, a 3,839-line config doc) and with a large open-PR backlog [I]. The 2,019 open PRs vs 1,203 merged suggest a lot of drive-by or agent-written PRs [G].

---

## 2. Domain model (plain words → firstmate term)

| Plain words | firstmate term | Mapping | Label + source |
|---|---|---|---|
| The human | **Captain** | "You are the first mate. The user is the captain." Present since the initial commit | [M] AGENTS.md:7-8; initial commit AGENTS.md:3-4 |
| The orchestrator agent | **First mate** (primary session) | The LLM session the captain talks to. Never does project work itself | [M] AGENTS.md:21-23, VISION.md:24-25 |
| A worker | **Crewmate** | A spawned agent CLI in its own worktree and terminal endpoint | [M] README.md:33, AGENTS.md:23 |
| Task kinds | **Ship** / **Scout** | Ship = project change via a delivery mode; Scout = report at `data/<id>/report.md`, never a PR | [M] AGENTS.md:185-186 |
| Sub-orchestrator | **Secondmate** | "A crewmate with an isolated firstmate home and a charter, not a second architecture." Local or a whole home on an SSH host | [M] AGENTS.md:24, AGENTS.md:60, docs/remote-secondmates.md:6-7 |
| Task instructions | **Brief** | `data/<id>/brief.md`, scaffolded by `bin/fm-brief.sh`, with `## Captain's intent` and `## Firstmate spec` sections | [M] AGENTS.md:224, AGENTS.md:388-403 |
| Worker → orchestrator events | **Status line** | Append-only `state/<id>.status`, `"<verb>: <note>"`. A line is a wake event, not current truth | [M] AGENTS.md:67, bin/fm-classify-lib.sh:93 |
| Orchestrator → worker message | **Steer** | Durable record in `state/<id>.inbox/` + a constant "doorbell" line typed into the terminal | [M] AGENTS.md:217 |
| Human decision | **Captain hold** | "A decision is simply a task held for the captain" via `bin/fm-captain-hold.sh` | [M] AGENTS.md:372 |
| Work queue | **Backlog** | `data/backlog.md` by default, via `tasks-axi` | [M] AGENTS.md:369 |
| Ship rigor | **Delivery mode** | `no-mistakes` / `direct-PR` / `local-only`, plus orthogonal `yolo` merge autonomy | [M] AGENTS.md:233-239 |
| Where a worker runs | **Runtime backend** | tmux (default), herdr, zellij, orca, cmux, paseo, rex, t3code, tern, hc | [M] bin/fm-backend.sh:103 |
| Which agent CLI | **Harness** | claude, codex, opencode, pi, pi-signed, grok, kimi, cursor, omp, agy; plus muse, gemini, rovo, devin, commandcode, polytoken, cortex, kiro, hermes for workers only | [M] AGENTS.md:92 |
| One instance | **Home** (`FM_HOME`) | Its own private `data/ state/ config/ projects/`; scripts come from the code root | [M] AGENTS.md:59-63 |

---

## 3. Architecture

```
captain (human)
   │  chat
   ▼
first mate = an agent CLI (Claude Code / Grok / Pi / Codex …) running in the repo, reading AGENTS.md
   │  bin/fm-spawn.sh            bin/fm-send.sh (steer)      bin/fm-control.sh (interrupt/exit/relaunch)
   ▼
runtime backend (tmux window / Herdr tab / T3 Code thread …)  ── one endpoint per task
   │
crewmate = another agent CLI, launched in a treehouse git worktree, writes state/<id>.status
   ▲
bin/fm-watch.sh  (bash, zero tokens) polls status files, panes, PRs, checks → prints ONE wake reason and exits
   │
harness hook (e.g. Claude Stop hook) rewakes the first mate → it drains the wake queue and acts
```

- **Scripts own mechanics, the agent owns judgment** [M] VISION.md:32-37. The always-loaded contract has a 9,000-word ceiling [M] VISION.md:39. The whole orchestrator policy is prose in `AGENTS.md` (435 lines) plus ~30 skills under `.agents/skills/` [M].
- **All state is on disk + in the live backend**; a restart reconciles from them [M] README.md:54, VISION.md:41-46, AGENTS.md:118-131.
- **Session start**: `bin/fm-session-start.sh` runs once and prints one ordered "digest" (backlog, metadata, status tails, network checks) that the agent reads once [M] AGENTS.md:72-81, bin/fm-session-start.sh:5,51.
- **Concurrency**: no global cap; dispatch isolated work immediately, bounded only by optional `config/project-capacity` (spawn exits 75 and stays queued) [M] AGENTS.md:203-205.
- **Remote**: only whole secondmate homes go remote over SSH; "Firstmate does not support placing an individual worker remotely" [M] docs/remote-secondmates.md:6-7.

---

## 4. The orchestrator/crew loop, in the source

**4a. Dispatch** [M]
1. Resolve project, classify ship vs scout, resolve delivery mode + yolo + branch prefix [M] AGENTS.md:171-201.
2. Pick harness/model: per-task captain override → best-fit dispatch profile → default → static crew harness; optional quota-aware ranking via `quota-axi` "spendPriority" [M] AGENTS.md:96-110.
3. Write brief with `bin/fm-brief.sh` [M] AGENTS.md:206, 388-403.
4. `bin/fm-spawn.sh` (8,342 lines) validates, creates a treehouse worktree, asserts isolation, moves the backlog item to In flight, and launches the harness [M] AGENTS.md:211-214; bin/fm-spawn.sh:2701 (`spawn_treehouse`), :4644 (`spawn_worktree_isolated`), :2887 (`launch_template`).

**4b. Supervision: the watcher** [M]
- `bin/fm-watch.sh` (4,930 lines) is a bash loop: `while :; do` at bin/fm-watch.sh:4060. Each cycle touches a liveness beacon, runs ledgers/syncs, pending-reply and open-decision ticks, secondmate liveness, process-event sources, `*.check.sh` sweeps, then status-signal and stale-pane classification [M] bin/fm-watch.sh:4060-4200 and onward.
- Defaults: poll 15 s, heartbeat 600 s backing off to 7,200 s, `*.check.sh` every 300 s with a 30 s timeout, 30 s grace to coalesce trailing signals [M] bin/fm-watch.sh:346, 363-366, 371.
- It **absorbs** benign wakes and **exits after printing exactly one actionable reason** (`signal:`, `stale:`, `check:`, `heartbeat`) [M] bin/fm-watch.sh:2-20; `wake()` prints, publishes, and `exit 0` at bin/fm-push-transition-lib.sh:94-115.
- Captain-relevant status verbs by default: `done:|needs-decision:|blocked:|failed:|PR ready|checks green|ready in branch|merged` [M] bin/fm-classify-lib.sh:93. `paused:` (expected external wait) and `captain-held` are absorbed and resurface on a long cadence [M] bin/fm-classify-lib.sh:96-149.
- **Wedge ladder**: a provably-working pane that stays stale escalates with a count, then a `demand-deep-inspection` marker, optionally a `PERMANENTLY-WEDGED` cap; dead or missing endpoints stop re-escalating [M] bin/fm-watch.sh:23-45, docs/architecture.md:21, 58-60. The doc cites a real case of 226 and 203 repeat escalations on finished lanes before this guard [M] docs/architecture.md:58.

**4c. Waking the LLM** [M]
- Per-harness "supervision protocol". Claude: the Stop hook (`asyncRewake`, `bin/fm-claude-stop-autoarm.sh`) arms the watcher at every turn end with no model tokens; an actionable exit rewakes the model via exit code 2 [M] docs/supervision-protocols/claude.md:1-9.
- The woken agent must first drain the durable wake queue (`bin/fm-wake-drain.sh`), handle `OPEN DECISIONS` / `UNREAD STATUS`, then ack with a generation-bound `--ack-through` [M] AGENTS.md:271-277.
- A **turn-end guard** blocks the agent from ending a turn "blind" while work is live and no watcher is healthy [M] AGENTS.md:269, docs/supervision-protocols/claude.md:24-27.

**4d. Steering and control** [M]
- `bin/fm-send.sh` = data plane: the message is written to `state/<id>.inbox/`, and the terminal only gets a doorbell line; the watcher re-rings unacknowledged messages [M] AGENTS.md:217.
- `bin/fm-control.sh <id> interrupt|exit|relaunch` = control plane; never send lifecycle keys as chat [M] AGENTS.md:220-221.

**4e. Landing and teardown** [M]
- Merge only via `bin/fm-pr-merge.sh`, which refuses red or unreported required checks [M] AGENTS.md:240-246.
- `bin/fm-teardown.sh` owns the "landed work" test and refuses to delete unlanded work without `--force` + captain consent [M] AGENTS.md:35-38, bin/fm-teardown.sh:2-12.

---

## 5. Agents and harnesses it drives (the adapter shape)

**How a harness is driven** [M]
- A launch command template per harness in `launch_template()` [M] bin/fm-spawn.sh:2887-3130. Examples:
  - claude: `claude --dangerously-skip-permissions …` by default (`config/claude-permission-mode` absent = bypass) [M] bin/fm-spawn.sh:849, 2940; docs/configuration.md:1650-1652.
  - codex: `--dangerously-bypass-approvals-and-sandbox` by default, `--disable hooks`, turn-end via `-c notify=` touching a file [M] bin/fm-spawn.sh:871, 2982-2987; docs/configuration.md:1628-1629.
  - cursor: `cursor-agent --trust --yolo --workspace <worktree>` [M] bin/fm-spawn.sh:3079.
  - gemini: `gemini -y` [M] bin/fm-spawn.sh:3114. grok: `grok --always-approve` [M] :3066.
  - devin: `devin --permission-mode dangerous --respect-workspace-trust false --config <file>` [M] :3118.
- The brief is passed as the first prompt (encoded via an operational-input helper; for Claude via a doorbell because Claude strips invisible characters) [M] bin/fm-spawn.sh:2946-2951.
- Interaction after launch goes through the **runtime backend interface**: `fm_backend_capture`, `send_key`, `send_text_submit`, `kill`, `busy_state`, `composer_state`, `agent_state`, `wait_transition`, `validate_harness` … [M] bin/fm-backend.sh:1204-1686. Most backends are terminal multiplexers, so control = typing into and reading a terminal [I].
- Exception: the **T3 Code backend** drives the T3 server over its Orchestrator V2 `/mcp` endpoint, nothing typed into a terminal; only claude and codex [M] docs/t3code-backend.md:3-4, 12. firstmate warns unless T3 telemetry is proven off [M] docs/t3code-backend.md:22-27.

**Adapter = an "operating facts" table + verification** [M]
Each harness has a reference under `.agents/skills/harness-adapters/references/harness/<name>.md`, routed by a JSON table [M] .agents/skills/harness-adapters/SKILL.md:58-104. Devin's, verified with Devin CLI 3000.11.1 on 2026-09-21/22, lists [M] references/harness/devin.md:1-24:
busy state (native `UserPromptSubmit`/`Stop`/`SessionEnd` hooks), exit command, interrupt keys and timing, skill invocation, resume (`devin -r <id>`), model flag, effort flag, model discovery + auth preflight (`devin models list`, `devin auth status`), process marker, trust dialogs, imported config, commit attribution.
- "Never dispatch on an unverified adapter" [M] SKILL.md:25. Workers-only harnesses: Muse, Gemini, Devin, Command Code, Polytoken, Cortex, Kiro, Hermes [M] SKILL.md:36.
- "Busy state is semantic, per adapter" [M] docs/architecture.md:281.
- firstmate itself calls screen-reading adapters "a standing debt… expected to break on that vendor's next release" [M] VISION.md:64-66.

Plain take: the adapter is not a code interface; it is a markdown fact sheet + bash `case` branches + a busy-state hook [I]. The **fact sheet columns** are exactly what Flotilla's `AgentAdapter` needs [I].

---

## 6. State, memory, isolation

**State/memory files** [M] AGENTS.md:63-68, docs/configuration.md:91-120
- `data/captain.md`: captain preferences (the main long-term memory about the human). `data/captain-shared.md`: shared down to secondmates.
- `data/learnings.md`: curated home-local knowledge. `data/projects.md`, `data/secondmates.md`: registries.
- `data/backlog.md` (+ `data/done-archive.md`): work queue; decisions live here as held tasks.
- `data/<id>/brief.md`, `data/<id>/report.md`: per-task brief and scout report.
- `data/pipeline-spend.jsonl`: optional per-task token ledger (§7).
- `state/<id>.meta` (harness, backend, endpoint…), `state/<id>.status` (append-only events), `state/<id>.inbox/` (steers), `state/pending-replies/`, wake queue, `.afk` records.
- `config/*`: one-token local choices (`crew-harness`, `backend`, `project-capacity`, `claude-permission-mode`…).
- Memory is files reread at session start, not chat history [M] VISION.md:43-45.

**Isolation** [M]
- Per task: a treehouse git worktree; the spawn refuses if the worktree is not distinct from the primary checkout [M] AGENTS.md:212, 396; bin/fm-spawn.sh:4644.
- The orchestrator is "read-only over your projects" by rule (prompt-level), with narrow script-guarded exceptions [M] AGENTS.md:28-32.
- Guard hooks exist (cd guard, arm pretool check, subagent guard, git push guard for `forge=external`) [M] docs/cd-guard.md, docs/arm-pretool-check.md, bin/fm-git-push-guard.sh:2-14.
- **No OS-level sandbox**: no container, VM, bwrap, firejail or dedicated user for workers. Docker/podman appear only in the Linux test runner [M] grep of bin/ and docs (only hit: bin/fm-test-linux.sh:3-109). "Container" elsewhere means a UI container (tmux session / Herdr workspace) [M] bin/backends/herdr.sh:14-16.
- Workers run under the captain's own user with permission bypass defaults (§5) [M]. So a crewmate can touch anything the user can [I].
- Secondmate homes are isolated by `FM_HOME` directories and a session lock, not by OS boundaries [M] AGENTS.md:60-61.

---

## 7. Budgets

- **No per-task or per-orchestrator $ or token cap** that stops work [M] (grep of `bin/` for usd/budget/token cap found none; only items below).
- Away-mode **concurrent worker cap** `spend_max_concurrent_workers` (default 4 or current count): new spawns refuse while away [M] bin/fm-afk-contract.sh:55-58, 129-142, 163; enforced at bin/fm-spawn.sh:2256-2288.
- **Quota-aware dispatch**: reads subscription windows via `quota-axi`, ranks candidates by `spendPriority`, never silently downgrades the reasoning class [M] AGENTS.md:99-109, bin/fm-quota-choose.sh:2-20, bin/fm-claude-account-quota.sh:2-30.
- **Usage warner**: opt-in, speaks once when a Claude usage window crosses a %; a warner, not a stop [M] bin/fm-usage-warner.sh:2-30.
- **Pipeline spend ledger**: opt-in, after the fact, records no-mistakes token usage per task at teardown [M] bin/fm-pipeline-spend.sh:2-27.
- Policy: "Mention cost as a courtesy when unusually much work is running, but never block on it." [M] AGENTS.md:365.

Gap vs mehdi's spec (runtime-enforced hard token/$ caps that pause and ask): firstmate has nothing to reuse for the enforcement itself; the quota-reading and spend-ledger ideas help with metering only [I].

---

## 8. Human-in-the-loop

- Hard rules in priority order: never write to a project; never merge without the captain's explicit word; never tear down unlanded work; crewmates never address the captain; report outcomes faithfully [M] AGENTS.md:26-43.
- Only "captain-relevant decisions, review-ready PRs, failures, and credential needs" surface [M] AGENTS.md:130. Progress and empty polls are never news [M] AGENTS.md:296, VISION.md:16.
- Decisions = held backlog items with `--reason` and optional `--until` [M] AGENTS.md:372. Keyed decisions (`needs-decision: [key=…]`) are closed by `fm-send --resolve-key` [M] AGENTS.md:219, bin/fm-classify-lib.sh:662.
- One message per decision with options + recommendation [M] AGENTS.md:344-345 (and GROK_BOT.md:27).
- A translation table turns internal words (worktree, wake, hold…) into plain words for the human [M] AGENTS.md:317-342.
- `yolo` lets firstmate merge green, in-scope PRs itself; red merges still need explicit word [M] AGENTS.md:238-243.
- Away (`/afk`) and quiet modes, with a daemon owning triage while away [M] AGENTS.md:305-309.
- Optional Relay: answer public X/Discord mentions [M] README.md:52.
- Single-user by design: "It empowers exactly one individual" [M] VISION.md:7.

Note: the repo ships `GROK_BOT.md`, a firstmate persona for a bot platform (crewmates = other bots, "address the captain as captain") [M] GROK_BOT.md:1-31. Read as data only; it does not change Flotilla's rules.

---

## 9. Did Capy's Captains come from firstmate?

**Evidence**

| Check | firstmate | Capy | Label |
|---|---|---|---|
| Who is "Captain" | The **human** user | The **orchestrator agent** | [M] AGENTS.md:7-8; CAPY.md:33 |
| Orchestrator name | First mate | Captain | [M] same |
| First use of "Captain" | Initial commit, Jun 11, 2026 | Feb 2026 (read-only planner); Apr 16, 2026 Captain "delegates implementation to Build agents" | [M] initial-commit AGENTS.md:3-4; CAPY.md:56-57 (capy.ai/blog/captain-vs-build, /blog/april-2026-update) |
| Crew-orchestrator shape | Since Jun 11-12, 2026 (crewmates, watcher, briefs) | "long-running thread that directs other threads as its crew": Sep 24, 2026 (0.3.0); GA Oct 31, 2026; changelog restart Aug 11, 2026 | [M] initial-commit README.md:27; CAPY.md:58-60 |
| Memory files | `data/captain.md`, `data/learnings.md`, `data/backlog.md`, `data/<id>/brief.md`, `state/<id>.status`, `AGENTS.md` | Drive: `AGENTS.md`, `CREW.md`, `NOTES.md`, `DIGEST.md`, `skills/`, `reports/`, `handoffs/` | [M] AGENTS.md:63-68; CAPY.md:46-51 |
| `NOTES.md` / `CREW.md` / `DIGEST.md` in firstmate | **None** (grep of the whole repo) | Core files | [M] grep; only `captain.md`, `MEMORY.md` ×3, `BACKLOG.md` ×1 hits |
| "Digest" | Session-start digest printed **to the agent** | `DIGEST.md` shown **to the human** | [M] bin/fm-session-start.sh:5; CAPY.md:303-307 |
| "Scout" | Task type, added Jun 12, 2026 (PR #7) | YC jobs page "Scout" product name (date unknown) | [M] GH-API commits; CAPY.md:62 [G] |
| Shared vocabulary | crew, brief, digest, report only what needs a human, never merge without ask, memory reread on wake | same ideas | [M] both docs |
| Cross-mentions | No "capy" anywhere in firstmate | No "firstmate", "treehouse", "no-mistakes" in the Capy docs dump, gstack notes or HN dumps | [M] grep of research/ |
| Public link | None found. A Nov 2026 video groups "First Mate" (CLI kind) and Capy (app kind) as the same category, no lineage claim | [M] https://chooseto.ai/watch/Ae4V9p5Uvqg; web search Nov 26, 2026 |
| Code | Bash distro in a terminal | Closed, hosted, Firecracker VMs + API | [M] §1; CAPY.md:23, 40. Code comparison impossible: **unverified** |

**Verdict**
- The **name** "Captain" did not come from firstmate: Capy used it ~4 months earlier, for the agent, while firstmate uses it for the human. **[I], strong.**
- The **code** did not come from firstmate: no shared file names, different architecture and stack. **[I], medium** (Capy's code is closed, so this can't be checked directly).
- The **orchestrator-over-workers idea** existed at Capy before firstmate (Apr 2026 Captain → Build agents). **[I]** from CAPY.md:57.
- The **Sep 2026 redesign** (long-lived Captain running a "crew", reports-only-what-needs-you, file memory) came 3 months after firstmate went public and became popular (9k stars). Influence is **possible but unproven: [G]**. Convergent design is just as likely, because the nautical metaphor and AGENTS.md conventions are common [G].
- Net: mehdi's claim should be filed as **"not supported; at most a guess of conceptual influence."**

---

## 10. Things I checked by running code (offline)

- `tests/fm-classify-decision-key.test.sh`: 23 ok / 0 not ok [M].
- `tests/fm-git-push-guard.test.sh`: 5 ok / 0 not ok [M].
- `tests/fm-backend.test.sh`: 31 ok / 1 not ok. The failure is caused by our **shallow clone** ("the code root … has no readable history, or a shallow clone shares no root commit") [M], not by a firstmate bug [I].
- Takeaway: tests are hermetic bash with fixtures (incl. a fake T3 server `tests/t3-fake-server.mjs`) and run offline [M]. That's a good model for Flotilla's "scripted fake agent" rule [I].

---

## 11. Gaps vs Capy parity (what firstmate does NOT give Flotilla)

| Capy feature (CAPY.md) | firstmate | Label |
|---|---|---|
| Cloud VMs per thread | None; local terminals only | [M] README.md:45, docs/remote-secondmates.md:7 |
| Run a single thread on a chosen remote machine | No: only whole secondmate homes go remote, over SSH | [M] docs/remote-secondmates.md:6-7 |
| Move a thread between machines mid-task | Not supported | [I] (not found in docs) |
| Web/desktop/mobile UI, digest tab, sidebar | None; chat with a CLI agent + terminal windows (optional "calm" mod, Bearings board) | [M] README.md:45; .claude/mods/firstmate-calm/ |
| Public REST API + SSE | None | [I] (not found) |
| Slack integration | None; Relay covers X and Discord mentions only | [M] README.md:52 |
| Multiplayer / shared Captains / Captain-to-Captain | Explicitly single-user | [M] VISION.md:7 |
| Drive (shared files, scopes) | None; private `data/` per home | [M] AGENTS.md:63 |
| Automations (triggers, schedules) | Only `*.check.sh` polls on the watcher and process-event sources | [M] bin/fm-watch.sh:365-366, docs/verification/process-event-sources.md |
| Issues tracker / board | `data/backlog.md` via tasks-axi | [M] AGENTS.md:369 |
| Previews | Not found | [I] |
| Side chat / fork / subagents (3 levels) | Subagents discouraged for the first mate; depth capped | [M] VISION.md:38, GROK_BOT.md:13 |
| PR autofix loop (CI, reviews, conflicts) | Delegated to no-mistakes + PR follow/health scripts | [M] AGENTS.md:229-237, bin/fm-pr-follow.sh, bin/fm-pr-health.sh |
| Hard budgets | None (§7) | [M] |
| Sandboxed laptop runs | None (§6) | [M] |

Where firstmate is **ahead of Capy** (worth copying): 19 verified agent CLIs (Capy: one native engine + Claude Agent SDK, CAPY.md §3); zero-token event supervision; quota-aware model routing; explicit delivery modes; refusal to delete unlanded work; durable decisions and steers; restart-proof reconciliation [M] for firstmate side, [I] for the comparison.

---

## 12. What Flotilla should reuse (MIT: OK with attribution)

Keep the MIT notice and a NOTICE/ATTRIBUTION entry for anything copied or ported [M] LICENSE.

1. **Harness fact sheets → AgentAdapter definitions.** Port the 19 `references/harness/*.md` tables (launch flags, busy-state hooks, interrupt/exit/resume, model and effort flags, auth preflight, trust dialogs, attribution switch) into typed adapter configs. Biggest shortcut for "every coding agent" in phase 1 [I].
2. **Status-event vocabulary + classifier semantics** (`done/needs-decision/blocked/failed/paused/captain-held/resolved`, keyed decisions closed by an answer) → Flotilla `Event` and `Approval` types [I]. Source: bin/fm-classify-lib.sh:84-149, 647-662.
3. **Watcher triage rules** (absorb vs surface, 30 s coalescing, heartbeat backoff 600→7,200 s, wedge escalation ladder with a cap, dead-endpoint suppression) → re-implement in TypeScript in the server daemon, not in bash [I]. Source: bin/fm-watch.sh:2-80, 346-371.
4. **Hard rules as kernel guards in code**: never merge red or without approval (unless explicit yolo), never delete unlanded work, workers never talk to the human directly, orchestrator never edits project files [I]. Source: AGENTS.md:26-43, bin/fm-teardown.sh, bin/fm-pr-merge.sh.
5. **Durable steering inbox + doorbell** and the data-plane/control-plane split (`fm-send` vs `fm-control`) [I]. Source: AGENTS.md:217-221.
6. **Captain-facing translation table** for the "needs you" UI copy [I]. Source: AGENTS.md:328-338.
7. **Quota-aware dispatch idea** (read subscription windows, never silently downgrade) [I]. Source: AGENTS.md:99-109.
8. **Worktree-per-task + isolation assertion** (or treehouse itself, license unverified) [I].
9. **Hermetic fake-harness / fake-server tests** as the pattern for Flotilla's scripted fake agent [I]. Source: tests/t3-fake-server.mjs, tests/fm-*-harness.test.sh.

## 13. What to avoid

1. **Bash as the core.** ~148k lines of shell is hard to type, test and port to a server [I]. Port ideas, not the scripts.
2. **Policy in prompts.** firstmate's guarantees live mostly in a 435-line `AGENTS.md` the LLM must obey (9,000-word cap) [M] VISION.md:39. mehdi's spec needs a code kernel hooks can't turn off [I].
3. **LLM-as-loop-owner.** The orchestrator is an LLM session that needs Stop hooks and turn-end guards to stay "alive" [M] docs/supervision-protocols/claude.md. Flotilla's daemon should own the loop and call the model only on a wake [I].
4. **Terminal scraping as the control plane** (capture pane, send keys). firstmate calls it "standing debt" itself [M] VISION.md:64-66. Prefer each CLI's JSON/stream/ACP/SDK mode [I].
5. **Bypass permissions with no sandbox** [M] §5-6. mehdi's spec requires container or dedicated-user isolation [I].
6. **Whole-home-only remoting** [M] docs/remote-secondmates.md:7. Flotilla needs per-thread machine choice over SSH/Tailscale [I].
7. **Cost as courtesy** [M] AGENTS.md:365. Flotilla needs enforced caps that pause and ask [I].
8. **Forking wholesale**: 2,019 open PRs and fast churn mean a fork would drift quickly [M]/[I].

## 14. Open questions

1. **Lineage**: any public statement from Capy (Scrapybara) or Kun Chen about influence? None found [M search]; still **unverified**.
2. **Dependency licenses**: treehouse, no-mistakes, gh-axi, tasks-axi, quota-axi, chrome-devtools-axi are not checked. Needed before reusing anything that calls them.
3. **Headless modes**: how many of the 19 harnesses can run non-interactively with a JSON/event stream (needed for containers and for avoiding terminal scraping)? The fact sheets only cover interactive TUI control [I].
4. **Tailscale**: firstmate never mentions it; its remote path is plain SSH plus Herdr [M] docs/remote-secondmates.md:22-30. Fit for Flotilla's BYO machines is untested.
5. **T3 Code backend**: firstmate already drives T3 Code over MCP (claude/codex only) [M] docs/t3code-backend.md. Relevant to step 3's "build on T3 Code" option.
6. **Activity numbers**: ~1,215 commits on main vs PR #8773 and 2,019 open PRs. How many PRs are agent-generated? Not measured.

---

## Sources

- Local: `research/firstmate/` (HEAD 9931328): README.md, VISION.md, AGENTS.md, LICENSE, GROK_BOT.md, docs/architecture.md, docs/configuration.md, docs/remote-secondmates.md, docs/t3code-backend.md, docs/supervision-protocols/claude.md, .agents/skills/harness-adapters/, bin/fm-spawn.sh, bin/fm-watch.sh, bin/fm-push-transition-lib.sh, bin/fm-backend.sh, bin/fm-classify-lib.sh, bin/fm-afk-contract.sh, bin/fm-pipeline-spend.sh, bin/fm-usage-warner.sh, bin/fm-quota-choose.sh, bin/fm-claude-account-quota.sh, bin/fm-teardown.sh, bin/fm-git-push-guard.sh, bin/fm-session-start.sh.
- https://api.github.com/repos/kunchenguid/firstmate (metadata), …/commits?until=2026-06-16 (early history), …/commits/ccdea30b8c89e5725695e35c54b414e5b3509b5d (initial commit), raw initial-commit AGENTS.md and README.md, GitHub search API counts (all fetched Nov 26, 2026).
- https://capy.ai/features/captains, https://docs.capy.ai/captains (via web search, Nov 26, 2026); https://chooseto.ai/watch/Ae4V9p5Uvqg.
- `research/CAPY.md` (step 1) for all Capy-side facts.
