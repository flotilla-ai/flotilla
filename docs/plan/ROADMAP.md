# ROADMAP.md: Flotilla phased MVP

Step 5 of the first-job playbook. Written Nov 27, 2026 (PKT). Builds on `SPEC.md` (shapes, kernel, adapters) and `research/BASE.md` (stack). Phase numbers match SPEC.md Appendix A (639 Capy rows: P1 50, P2 353, P3 192, P4 22, n/a 22).

Plain words: Phase 1 is the smallest thing that is already useful and already safe: on your own box, type a task, an agent works in a locked container, opens a PR, fixes its own CI a few times, and stops and asks you when it hits the money limit. A Captain can run up to 5 of those at once and write you a digest.

---

## Phase 1: "one box, safe, useful" (target: one dev + Devin units)

**In scope**
1. `docker compose up` → server + Postgres + egress gate (no Caddy, no queue in P1); first-run admin with a one-time setup token; session login; health check.
2. One hardened Docker container per thread (non-root, no sudo, cap-drop ALL, `--init`, no Docker socket, limits) on **its own internal network** whose only exit is the egress gate's allowlist; a process-group shim for real cancel; its own clone seeded from the server's bare mirror; reaper for orphans.
3. Adapters: `claude-code` (`claude -p --output-format stream-json`; `--bare` with API keys, always for untrusted projects), `codex` (`codex exec --json`), `generic-cli`, `fake` (scripted, used by all tests).
4. Append-only event log + row updates in one transaction; SSE per thread via LISTEN/NOTIFY.
5. Kernel: budget meter, reservations, hard caps per thread and per Captain subtree (tokens, $, wall clock), pause-and-ask Approval on cap hit, protected-branch guard, secret scrubber (incl. streamed deltas), isolation + network assertion.
6. Per-thread cost ledger (vendor $ when reported, else token estimate from an editable price table, plus machine seconds) shown live in the thread header; "soft cap" label for engines without a hard fence.
7. Projects with a trust flag: untrusted (default) = API key only, no login mounted; trusted = per-thread copy of the user's CLI login.
8. GitHub: server pushes from its own bare mirror (hooks off) and opens the PR; CI polling (default) or webhook wakes the owning thread; autofix with attempt cap 3 + same-signature stop (reviews, conflicts, oscillation guard and no-CI wakes are P2).
9. Live event UI: login, thread list, thread view (stream), Needs-you list, cost meter, Approve/Raise/Stop, queue/interrupt/stop, new thread, projects.
10. One preview URL per exposed port on a separate origin (`:8081`, through the gate), private by default. Caddy and wildcard hosts are P2.
11. Basic Captain: five MCP tools (`crew.start / crew.message / crew.release / digest.write / ask.human`) behind per-run tokens, ≤5 concurrent crew (kernel), digest with Needs you / New / In progress, firstmate-style wake coalescing and heartbeat backoff.

**Out of scope for P1** (later phases): BYO machines, Cursor/Gemini/ACP/Devin adapters, hooks, review agent, automations, Drive UI, web terminal (P1 prints a `docker run -it … claude auth login` helper), multi-user, Slack/Linear, monthly budget windows, RAM-based concurrency queueing, QA beyond what an agent does itself.

**P1 exit demo** (the "prove it works" for the whole phase)
```
docker compose up -d --wait
# in the UI: set up the admin with the printed token, add the GitHub PAT, add project = a test repo with a failing test (untrusted)
# new thread, engine=fake (CI) or claude-code (manual run; API key on untrusted, or mark the project trusted to use your own login), budget $0.50
# expect: events stream live → PR opened on flotilla/<code>-<slug> → CI red → autofix ≤3 → green or Approval
# set budget $0.01 → expect: run stopped (SIGINT), run paused_budget, thread "paused", overshoot (if any) shown, orange Approval "Budget hit: raise or stop"
# in the thread: curl https://example.org → blocked by the gate; curl to an allowlisted host → works
# Captain with 5 crew tasks → digest shows 5 rows; crew #6 request → kernel.denied
# expose port 3000 in a thread → open http://<host>:8081/p/<code>/3000/ → works; UI cookie alone → 401
```

### Phase 1 units (Devin handoffs in `handoffs/phase1-*.md`)

Waves follow DEVIN-PLAYBOOK.md §3a: units in one wave own disjoint files; max 4 at once; a wave starts after mehdi merged the previous wave into `flotilla/p1`. Repo: `flotilla-ai/flotilla`. Each unit opens a PR against `flotilla/p1`; mehdi reviews and merges (never `main`). Pre-launch checks P1-P5 are in `handoffs/README.md`.

| Unit | Name | Wave | Depends on | Owns (scope) | Done signal (short) |
|---|---|---|---|---|---|
| 01 | skeleton, compose, core types, loader | 1 | none | repo root, all package stubs, `packages/core/src/types.ts`, server `index/loader`, gate stub | `make check` green; `docker compose up --wait` + `/healthz` → `ok`; loader test; internal networks in compose |
| 02 | event store + P1 schema + SSE | 2 | 01 | `apps/server/src/db/`, `events/` | one-tx test; SSE after=2; NOTIFY across connections |
| 03 | kernel: budget, caps, scrubber | 2 | 01 | `packages/core/src/kernel/` | cap-hit Approval `raise`/`stop`; reservations; wall fence; split-secret delta scrub |
| 04 | adapter host + LocalTransport + fake + generic-cli | 2 | 01 | `packages/adapters/{host,fake,generic-cli}/` | fixture → exact events; cancel kills grandchildren < 10 s |
| 05 | docker driver, network, exec shim, reaper | 2 | 01 | `apps/server/src/machines/`, `deploy/thread.Dockerfile` | hardened + internal-network asserts; no route out; shim cancel; login copy excludes transcripts |
| 06 | claude-code adapter | 3 | 04, check P2 | `packages/adapters/claude-code/` | `--bare` iff api-key; strict MCP/settings flags with login; micro-USD usage |
| 07 | codex adapter | 3 | 04 | `packages/adapters/codex/` | JSONL fixture → events; resume argv |
| 08 | auth, projects, read APIs | 3 | 02 | `apps/server/src/{auth,projects}/` | setup once; cookie flags; CSRF; trust default untrusted |
| 09 | git mirror (seed + push) | 3 | 02, 05 | `apps/server/src/git/` | planted hooks/config never run; main refused; token never in config |
| 10 | egress gate | 4 | 05 | `apps/gate/`, `apps/server/src/gateClient/` | allowlist + public-IP rule; tools relay; previews only with bearer |
| 11 | thread runner | 4 | 02, 03, 04, 05, 09 | `apps/server/src/runner/` | e2e: reserve → pause on cap → raise/stop; ticker; queue/interrupt/stop |
| 12 | web UI core | 4 | 02, 08 | `apps/web/` (not `features/`) | Playwright: login, live stream, cost meter |
| 13 | web UI actions | 5 | 11, 12 | `apps/web/src/features/` | Playwright: Needs-you Raise/Stop, new thread, trust toggle |
| 14 | GitHub PR + CI autofix | 5 | 09, 11 | `apps/server/src/github/`, `kernel/autofix.ts` | poll = webhook; 3 attempts then Approval; same signature stops at 2 |
| 15 | previews (separate origin) | 5 | 05, 08, 10 | `apps/server/src/previews/` | `:8081` with preview token 200, without 401; UI cookie rejected |
| 16 | Captain tools (MCP) | 5 | 10, 11 | `apps/server/src/captain/tools/`, `kernel/crewLimits.ts` | 5 crew, 6th denied; foreign token 403; expired 401 |
| 17 | Captain scheduler + digest | 6 | 16 | `apps/server/src/captain/scheduler/` | 3 dones → 1 wake; heartbeat backoff; digest sections |

Rough size: 17 units in 6 waves, each sized ≤3 h for Devin (DEVIN-PLAYBOOK.md §1.6 [V S15, S23] in that file). Calendar time depends on mehdi's review speed between waves [G].

**Recommended first handoff:** `handoffs/phase1-01-skeleton.md` (everything else depends on it, it's small, and it proves the Devin setup works: `make check`, `docker compose` and an internal Docker network inside Devin's VM, which DEVIN-PLAYBOOK.md §7.7 lists as untested).

---

## Phase 2: "core parity, your machines, any agent"

- `flotilla-runner` for BYO Linux/macOS machines: outbound WebSocket over Tailscale or `ssh -R`; container/VM isolation by default (Docker; Colima/OrbStack/Lima on macOS), dedicated OS user only as opt-in "reduced isolation"; pairing code flow; the P1 `flotilla-exec` shim becomes its process supervisor.
- Adapters: `cursor`, `gemini`, `acp` (generic), `devin` (REST v3, `remote-vendor` isolation warning); Codex app-server mode for mid-turn steer.
- Hooks + kernel: hook bundle repo per Captain, QuickJS isolate hook runner in a `--network none` container, replay tests against recorded logs, approval to activate, one-click rollback.
- Full Captains (promote/demote, crew rules, digest answers in one line, Captains messaging each other), wakes/timers/watches, subagents, steer/queue/interrupt delivery modes.
- Review agent (read-only thread on PR head), reviews/conflicts/oscillation/no-CI wakes in the autofix loop, monthly budget windows, automations (cron/GitHub/webhook) with pg-boss + outbox, Drive with full version history, skills and rules mounting, MCP registry, environments/setup scripts/snapshots, secrets vault UI, usage page.
- Browser QA via Playwright MCP.
- **Native harness** as one more adapter. It can become default only after it beats the official-CLI adapters on Flotilla's own internal task set (pass rate, $ per passed task, interventions). Internal regression between our own engines only; no comparisons against other products.

## Phase 3: "teams and integrations"

Orgs, roles, SSO (OIDC/SAML), audit log, multiplayer threads, Slack, Linear, issues board, stacked PRs, GitLab/Forgejo, Vercel/Cloudflare preview detection, desktop stream (Xvfb + noVNC), "Continue on" (move threads between machines), gVisor/Kata runtimes, remaining API endpoints, keyboard shortcuts, notifications, UI polish.

## Phase 4: "long tail"

Mobile QA (Android emulator on KVM hosts, iOS on BYO Mac, Maestro/Appium), OIDC cloud credentials per thread, Firecracker or E2B-runtime backend, plugin marketplace, voice dictation with local STT.

---

## Risks to the plan

1. **Docker-in-Devin** for units 01, 05, 09, 10, 11, 15 is untested (DEVIN-PLAYBOOK.md §7.7). Unit 01 proves it first; if it fails, those units use a mocked Docker API in Devin and mehdi runs the real integration test locally.
2. **Vendor JSON formats drift.** Adapters are tested on recorded fixtures with a pinned `versionRange`; a weekly manual smoke on the latest CLI catches drift (free models only).
3. **Scope creep in P2** (353 rows). P2 will be split into P2a (runner + adapters + hooks) and P2b (review/automations/Drive) when P1 ships.
4. **Claude login in containers** is decided (SPEC.md §6a, §15): untrusted projects use API keys only; trusted projects get a per-thread copy of the user's login, never the shared volume; the server never reads it. Whether a copied login survives token refresh, and the Anthropic-terms reading of a host volume, are pre-launch checks P2/P4. Unit 06 tests stay fixture-only.
5. **Hard caps are bounded, not instant** (SPEC.md §13): agents that report usage only at turn end can overshoot by up to one turn. Reservations stop parallel crew from jointly overspending; overshoot is always recorded.
6. **Subscription-mode Claude can't use `--bare`** (SPEC.md §5b): on trusted projects the adapter relies on `--strict-mcp-config --setting-sources user` (unverified until check P2) and the egress gate. Untrusted projects never use a subscription login.
7. **Egress allowlist breaks tools** that ignore proxy env vars or need unlisted hosts (package registries). That fails closed by design; projects add hosts to `egressAllow`.
