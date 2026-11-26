# Phase 1 handoffs (index)

One file per verifiable unit, format from DEVIN-PLAYBOOK.md §3b plus the brief's handoff checklist. Run order and waves: ROADMAP.md "Phase 1 units". Nothing here has been launched. Repo: `flotilla-ai/flotilla`. Units open PRs against the protected staging branch `flotilla/p1`; mehdi reviews and merges. Never push to `main` or `flotilla/p1`.

| Wave | Units (max 4 at once, disjoint scopes) | Depends on |
|---|---|---|
| 1 | 01-skeleton | none |
| 2 | 02-event-store, 03-kernel-budget, 04-adapter-host, 05-docker-driver | 01 |
| 3 | 06-claude-code-adapter, 07-codex-adapter, 08-auth-projects-api, 09-git-mirror | 06,07←04; 08←02; 09←02,05 |
| 4 | 10-egress-gate, 11-thread-runner, 12-web-ui-core | 10←05; 11←02,03,04,05,09; 12←02,08 |
| 5 | 13-web-ui-actions, 14-github-autofix, 15-previews, 16-captain-tools | 13←11,12; 14←09,11; 15←05,08,10; 16←10,11 |
| 6 | 17-captain-scheduler | 16 |

17 units (REVIEW-2 added auth/projects/read APIs, the git mirror and the egress gate, and split the web UI and the Captain). Old → new numbers: 08 runner → 11, 09 web UI → 12 + 13, 10 GitHub → 09 (mirror) + 14 (PR/CI), 11 previews → 15, 12 Captain → 16 + 17.

## Pre-launch checks (each gates the unit named; record results in `docs/runlog/prelaunch.md`)

| # | Check | Who / how | Gates | If it fails |
|---|---|---|---|---|
| P1 | Docker inside Devin's VM: `docker run hello-world` and an `--internal` network with no route out | Unit 01 does it first and pastes output | 05, 09, 10, 11, 15 integration tests | Those units mock dockerode and keep `FLOTILLA_DOCKER_IT=1` tests; mehdi runs them on his Mac before merging |
| P2 | Claude OAuth smoke test (1 minute, mehdi's own login, on his Mac): `CLAUDE_CONFIG_DIR=/tmp/cc claude auth login`, then `CLAUDE_CONFIG_DIR=/tmp/cc claude -p "say hi" --output-format stream-json --verbose --max-budget-usd 0.05 --strict-mcp-config --setting-sources user`. Record: does it run under OAuth without `--bare`; does `--bare` refuse OAuth; do both flags exist; is `--max-budget-usd` honoured under a subscription; do assistant lines carry `message.usage` mid-turn; the init line's session id field; which hosts it contacts (for `egressHosts`); does `HTTPS_PROXY` work; does a **copy** of `/tmp/cc` still work after the original refreshes its token | mehdi | 06 (argv), 10 (allowlist), 11 (login copy) | Edit unit 06's argv rules / SPEC §6a fallback before launching 06 |
| P3 | Codex check: `codex exec --json "say hi"` — env var (`CODEX_API_KEY` vs `OPENAI_API_KEY`), JSONL event and usage field names, resume syntax, hosts contacted | mehdi or unit 07 from the docs | 07 | Unit 07 marks fields unverified and uses synthetic fixtures |
| P4 | Terms read: Anthropic (login volume on an operator host), OpenAI/Codex, Cursor, Gemini consumer terms for unattended container runs | mehdi (human read) | public release, not P1 code | Restrict to API keys (already the default for untrusted projects) |
| P5 | Devin: is SWE-2.1 Max metered in cloud sessions; what `max_acu_limit` does on Max | mehdi in the Devin UI | launching waves | Launch smaller waves |

## Before the first run

These steps are for mehdi. This bot does not create the org, repo, branches, protection rules, or install GitHub apps.

1. The repo https://github.com/flotilla-ai/flotilla exists (mehdi created it empty). Give it an **initial commit** on `main` (README + MIT LICENSE, e.g. GitHub's "Add file" button), because a branch can't be created in an empty repo and unit 01 branches from `flotilla/p1`.
   - Put in only the plan: `SPEC.md`, `ROADMAP.md`, `handoffs/`, `scripts/gen_parity.py`, `scripts/check_spec_ts.py`, `research/BASE.md`, `research/CAPY.md`, `research/FIRSTMATE.md`, `DEVIN-PLAYBOOK.md`. **Don't** push `research/t3code/`, `research/firstmate/` (full third-party clones; T3 Code's trademark rules apply), the Capy docs dumps and scrapes (`research/capy-*`, `research/build-inventory`, `research/gstack-capy.md`, `sulat14.html`, `hn*.json`), `dv/` (Devin docs dump) or `BOT-BRIEF.md` (private brief). Handoffs link to upstream commits instead of local clones.
2. Create branch `flotilla/p1` from the default branch. Protect `main` (require a PR, block direct pushes and force-pushes, no auto-merge). Protect `flotilla/p1` as the staging branch: units open PRs against it; only mehdi merges.
3. Install the Devin and Cursor GitHub apps on the `flotilla-ai` org, and grant them `flotilla-ai/flotilla` (DEVIN-PLAYBOOK.md §2). Unit 01 pushes `.github/workflows/check.yml`, which needs the app's workflows permission.
4. Start with `phase1-01-skeleton.md` alone; it also runs pre-launch check P1 (Docker and internal networks inside Devin's VM). P2-P3 aren't needed until wave 3.

Note on shared files: unit 01 stubs every P1 workspace package under its final name, pre-adds every shared server dependency, writes the final P1 `docker-compose.yml`, and makes routes (`src/routes/*.route.ts`) and lifecycle modules (`src/modules/*.module.ts`) auto-load. No later unit edits `apps/server/src/index.ts`, `apps/server/package.json`, `docker-compose.yml` or `deploy/server.Dockerfile`; kernel files are imported by subpath (`@flotilla/core/kernel/<file>`), so nobody owns a barrel. Two ownership hand-overs are explicit: `apps/server/src/auth/requireSession.ts` (stub from 01 → unit 08) and `apps/gate/**` (stub from 01 → unit 10). A unit may add dependencies only to a `package.json` inside its own SCOPE. `pnpm-lock.yaml` will conflict between parallel units: at merge time, take `flotilla/p1`'s lockfile and re-run `pnpm install` (the one expected overlap).
