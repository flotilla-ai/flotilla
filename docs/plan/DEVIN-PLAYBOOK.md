# Devin playbook for Flotilla (Max plan, SWE-2.1 Max)

Researched Nov 26, 2026 (PKT). Docs and release notes read were current to Nov 25, 2026. Nothing was run against Devin.

**Labels.** `[V Sn]` = verified in a Cognition doc/blog (source list at the bottom). `[3P Sn]` = reported by a non-Cognition source or a social post, not confirmed in docs. `[I]` = inferred from verified facts. `[G]` = guess. Anything unlabelled is a template, not a claim.

---

## 0. Read this first: the "free until Dec 8" claim is only half-true for cloud

- SWE-2.1 exists. SWE-2.1 Max exists as the top reasoning level (Low / Medium / High / XHigh / Max). Released Nov 24, 2026. [V S3, S4]
- **Free through Dec 8, 2026 (Pacific):** Cognition's model docs say it is free on self-serve plans **in Devin Desktop and Devin CLI, and "does not apply to Devin cloud sessions."** Cognition's own blog banner says the same: "Free through 12/8 on Desktop and CLI. Available in Devin Desktop, Cloud, and CLI at a discounted price until 1/30." [V S3, S4]
- **Cloud:** SWE-2.1 is a *preview* in cloud sessions "through December 22, 2026." [V S3, S22] After the free window it costs $0.50/1M in, $2.50/1M out, $0.05/1M cache reads until Jan 30, 2027, then $2/$10/$0.20 list. [V S3]
- **Conflicting posts:** the @cognition post says "free for all Devin Pro, Max, and Teams for the next two weeks," and @devindevelopers says "unlimited tokens for any paid Devin plan ... in Devin Cloud, Desktop, or CLI." [3P S18, S20] These are marketing posts; the docs and blog are narrower. **Treat cloud as possibly metered until you prove otherwise** (test in section 1, step 1).
- Free window ends end-of-day Dec 8 Pacific, which is about 13:00 PKT on Dec 9 [I].
- SWE-2 was free in Desktop/CLI only through Nov 30. Not in cloud. [V S3] Teams has a "Free (powered by SWE-2)" cloud mode (2 sessions at a time); that is Teams only, not Max. [V S5]

**What this means for "go all out":** the verified-free path is the **Devin CLI/Desktop, run locally** (CLI has subagents and scripted `-p` mode; section 4B). Cloud VMs (isolated, overnight, parallel) draw on your Max weekly quota, then on-demand credits at API pricing [V S5]. So in cloud, cap spend rather than assume it is free.

---

## 1. How to max it out (one screen)

1. **Test the promo first (2 min).** Note Settings > Usage & limits. Start one tiny cloud session on SWE-2.1 Max ("run the test command and stop"). Check whether quota moved. [https://app.devin.ai/settings/usage] If it moved, cloud is metered: use the budget guardrails (section 6).
2. **Set the default session agent to SWE-2.1 Max** (reported path: Settings > Devin > Session agents) [3P S18]. Check it in the model picker of the first session; SWE-2.1 appears under agent selector as "SWE-2.1 (preview)". [V S22]
3. **One orchestrator session, many children.** Say "managed Devin for each unit" or "start a parallel Devin session for each". Each child is a full Devin on its own VM with its own shell, browser, tests. [V S1] Children see no files from the parent; hand off via git branches. [V S2]
4. **Fan-out with a join step (5+ units)? Say "Use a workflow to ..."**: Dynamic Workflows = a Python script Devin writes; calls are recorded, runs resume, budget up to 7 days. [V S2] Fewer than ~5 units: plain managed Devins.
5. **Done signal = a command.** Every unit gets exact test commands with expected output. Devin docs: tasks with test suites/CI "yield the best results"; vague success criteria is the top don't. [V S15]
6. **Keep sessions short.** Rule of thumb: if it takes you ≤3 hours, Devin can likely do it; split longer. Performance "can sometimes degrade as the session gets longer." [V S15, S23] So: units sized for ≤3h, one PR each.
7. **Never let it wait on you overnight.** A session waiting for a reply sleeps after 5 min idle (no usage while asleep) and just sits there. [V S6] Put "decide, log, continue" in the prompt (template 3c).
8. **Repo setup is the single highest-leverage thing.** Cognition's words. [V S11] Blueprint snapshot + `AGENTS.md` + skills (section 2).
9. **Stack skills, not prompts.** Put the procedure in `.agents/skills/<name>/SKILL.md`, invoke with `@skills:<name>`. [V S10, S1]
10. **Agents never merge.** PRs only, to an integration branch, you merge. Enforce with GitHub branch protection, not with a prompt. [I]
11. **Devin Bots (Max includes them) = a Captain-style persistent coordinator** that runs child sessions for an outcome. [V S14] Good later; for now use a bounded orchestrator session, because a Bot has no separate spend cap on Max. [V S14]

---

## 2. Repo setup checklist (do once, ~1 hour)

- [ ] **Repo + access.** Connect GitHub in Settings > Connections and grant Devin **only** the Flotilla repo (your fork/private repo). [V S11] Other repos stay invisible to it. [I]
- [ ] **Branch protection on `main`** (GitHub side): require PR, block direct pushes, block force-push, no auto-merge. Create `flotilla/p1` as the **integration branch** that PRs target. Devin Review can enable GitHub auto-merge from its merge button, so leave auto-merge off. [V S16, I]
- [ ] **`AGENTS.md` at repo root.** Devin injects only the first **16 KiB**; put commands and hard rules at the top, move the rest to skills. [V S9] Starter below.
- [ ] **Skills** (replaces Knowledge/playbooks for new work):
  - Knowledge is deprecated and is being migrated into Skills. [V S10b] Playbooks are "moving to Skills"; accounts created on/after Oct 24, 2026 with no playbooks get HTTP 410 from `/playbooks`. [V S8]
  - Create `.agents/skills/flotilla-unit/SKILL.md` (worker procedure = template 3b body) and `.agents/skills/flotilla-orchestrate/SKILL.md` (template 3a body). Invoke with `@skills:flotilla-unit`. [V S10]
  - Optional: copy your pstack skills (`architect`, `principle-prove-it-works`, `principle-laziness-protocol`, `principle-subtract-before-you-add`) into `.agents/skills/`. Devin follows the open Agent Skills standard [V S10]; whether your pstack files load unchanged is [G].
- [ ] **Environment snapshot.** In a fresh session say: `Set up your environment for this repo.` Approve the suggested blueprint; a build makes the snapshot every session boots from. [V S11] Blueprint sections: `initialize` (once: runtimes, system packages), `maintenance` (deps; surfaced to the agent, not auto-run), `knowledge` (named entries such as `test`, `lint`). Rebuilds on save and about every 24h. Session changes never persist to the snapshot. [V S11]
  - Flotilla needs Docker/compose. A Devin doc example runs `docker-compose up -d postgres` inside a skill [V S10], but I did not find a statement that every VM supports nested Docker. Test this in step "smoke session" below. [I]
- [ ] **One test command.** A single entry (`make check` / `pnpm test`) that exits non-zero on failure and runs in under ~5 min, plus `make verify` for slow/e2e. Put both in `AGENTS.md` and the blueprint `knowledge:`.
- [ ] **Secrets.** Flotilla's own rules: free models or a fake agent only, nothing real needed. If a secret is ever needed, use Settings > Secrets, never the prompt. [V S11]
- [ ] **Settings toggles** (Settings > Preferences): leave **Auto-approve child sessions** ON for overnight (OFF while you test, so you see each batch before it launches). [V S1] Same for **Auto-approve workflows**. [V S2]
- [ ] **Budget** (Settings > Usage & limits): turn **auto-reload OFF**, set a default session spending limit. [V S5] Empty on-demand balance = sessions pause until quota refreshes. That is your hard stop. [V S5]
- [ ] **Unit files** `handoffs/phase1-NN-<name>.md`, each with the header in template 3b.
- [ ] **Smoke session** (cheap): "Run the test command on a clean checkout, report the output, check `docker compose version`, stop." If this fails, fix the blueprint before any fan-out.

Starter `AGENTS.md` (top of file; keep under 16 KiB):

```text
# AGENTS.md
## Commands
- Test (done signal): `make check`   - Full: `make verify`   - Lint: `make lint`
## Hard rules
- Never push to or merge into main. Never force-push. Never merge any PR, including your own.
- Work on branch flotilla/<unit>. Open the PR against flotilla/p1 only.
- Never print, log, or commit secrets. No keys in .env.example. Tests use a fake agent or free models only.
- Do not touch files outside the unit's SCOPE. If you must, stop and report.
- Prove it by running it. Paste real command output, never claim "should work".
- Mark unknowns "unverified". Never invent facts or numbers.
## Style
- Smallest diff that meets the done signal. Types and data shapes first. Delete dead code.
```

---

## 3. Copy-paste prompts

Fill the `{{...}}`. Start these in a **new cloud session with SWE-2.1 Max selected**, repo = Flotilla.

### 3a. Orchestrator (splits a phase into parallel units, spawns child sessions)

```text
You are the ORCHESTRATOR for Flotilla Phase {{1}}. Repo: {{OWNER/REPO}}. Integration branch: flotilla/p1 (PRs target it, never main).
Use @skills:flotilla-unit for every child.

PREFLIGHT (stop and report if any fails):
1. Read AGENTS.md. Run `make check` on a clean checkout of flotilla/p1; paste the tail of the output. If red, stop.
2. Read every file matching handoffs/phase1-*.md. Each file is one UNIT with GOAL, SCOPE (files it owns), OUT OF SCOPE, SHAPES, DONE SIGNAL, BRANCH.

PLAN (post it in this session before spawning):
3. Build a dependency graph and group units into WAVES. A wave may only contain units whose SCOPE file sets do not overlap and that do not depend on each other. Write the table: unit | wave | scope | done signal.
4. Run only wave 1 now. Max {{4}} child sessions at once, max {{8}} children total this run. Later waves wait until the human has merged the earlier PRs.

SPAWN (managed Devins, one child per unit, each on its own VM):
5. For each unit start a child with: the unit file path as its task, @skills:flotilla-unit, branch flotilla/<unit>, tag "flotilla-p1", the same agent/model as you (SWE-2.1 Max), and a per-session limit of {{LIMIT}}. Require structured output: {branch, pr_url, tests_passed, summary, unverified[]}.
6. Do not poll in a loop. You are woken when a child finishes or needs input. Between wake-ups schedule a message to yourself every {{30}} minutes to check ACU/quota use and stuck children.

VERIFY (do not trust a child's summary):
7. For each finished child, check out its branch yourself, run the unit's DONE SIGNAL commands and `make check`, and read `git diff --stat flotilla/p1...<branch>`. Reject if any file is outside SCOPE, the diff is larger than the unit needs, a test was weakened/deleted, or a secret appears.
8. On reject: send the child ONE corrective message with the exact failing command and output. After one retry still failing, mark it BLOCKED and move on.

OUTPUT:
9. Write RUN-REPORT.md (branch flotilla/p1-report, PR against flotilla/p1): table of unit | status (DONE/BLOCKED/NEEDS-HUMAN) | PR | test output tail | diff stat | decisions I need from the human | unverified items | usage consumed per child.

RULES (hard):
- NEVER merge any PR, enable auto-merge, push to main or flotilla/p1, or force-push. Open PRs only.
- NEVER print secrets. Use free models or the fake agent in tests.
- STOP spawning and report immediately if: a session status_detail shows a usage/credit/quota limit, total children would exceed the cap, `make check` is red on the integration branch, or two children need the same file.
- When done, end with a 10-line summary. Do not start wave 2.
```

**Variant, same job as a recorded, resumable script** (use when ≥5 units and you want the join):

```text
Use a workflow to run Flotilla Phase 1: one agent per handoffs/phase1-*.md unit (wave 1 units only, max {{4}} concurrent), each on its own branch flotilla/<unit> using @skills:flotilla-unit, then a final agent that runs each branch's DONE SIGNAL and `make check`, rejects out-of-scope diffs, and writes RUN-REPORT.md. Agents push branches and open PRs against flotilla/p1 only; nothing merges. Run it on the first 2 units as a slice and show me the ACU/quota use before the full run.
```
[V S2: structure, "run on a slice first", cost warning. The unit/branch details are my template.]

### 3b. Single-unit worker (also the body of `.agents/skills/flotilla-unit/SKILL.md`)

Unit file header (`handoffs/phase1-NN-name.md`):

```text
# UNIT {{id}}: {{name}}
GOAL: {{one line}}
BRANCH: flotilla/{{id}}   PR TARGET: flotilla/p1 (never main)
SCOPE (you own only these paths): {{paths}}
OUT OF SCOPE: {{paths/behaviours}}
SHAPES: {{named types/interfaces to use, exact}}
DONE SIGNAL: {{exact commands}}  EXPECTED: {{exit 0 + specific output}}
DIFF BUDGET: at most {{N}} files / {{M}} changed lines
```

Worker prompt:

```text
Do the unit in {{handoffs/phase1-NN-name.md}}. Repo {{OWNER/REPO}}.
1. Read AGENTS.md and the unit file. Restate GOAL, SCOPE, DONE SIGNAL in 5 lines in your first message.
2. Create branch flotilla/{{id}} from flotilla/p1.
3. Write the failing test or acceptance script for the DONE SIGNAL FIRST. Run it; confirm it fails for the right reason.
4. Implement the smallest change that makes it pass. Types and data shapes before logic. No unrelated refactors.
5. CHECKPOINT after each milestone and at least every ~45 minutes: run `make check`, commit, push the branch, append 3 lines to docs/runlog/{{id}}.md (done / next / risks). At each checkpoint re-read GOAL and SCOPE; if the diff is drifting past DIFF BUDGET or touching OUT OF SCOPE, stop and report instead of continuing.
6. If blocked on a decision, choose the most conservative option, write it to docs/runlog/{{id}}.md under DECISIONS, and continue. If blocked on a credential, permission or missing dependency, stop that part, say so, and finish what you can.
7. Done = DONE SIGNAL passes AND `make check` passes AND you pasted the real output. Test the real thing (run the app/CLI, a screenshot or log) not just unit tests, when the unit is user-visible.
8. Open a PR against flotilla/p1 titled "{{id}}: {{name}}" with: goal, diff summary, pasted test output, unverified items. Do NOT merge it. Do not push to main or flotilla/p1.
9. Final structured output: {branch, pr_url, tests_passed, summary, unverified[]}.
Never print secrets. Free models or the fake agent only. Mark unknowns "unverified".
```

### 3c. Overnight run (checkpoints, no waiting, morning report)

```text
OVERNIGHT RUN for Flotilla Phase {{1}} wave {{1}}. Start now. Hard stop at {{06:00 PKT}} (Asia/Karachi). The human is asleep and will not answer.

Operate as in @skills:flotilla-orchestrate with these overrides:
- NEVER wait for the human. If you or a child would ask a question: pick the most conservative option, log it in the unit's `docs/runlog/<id>.md` DECISIONS section with the reason, continue. Park (do not retry) anything that needs a credential, permission or purchase.
- Max {{4}} children at once, {{8}} total. Each child sized for <=3 hours; if a unit looks bigger, split it in the plan before spawning and say so.
- CHECKPOINTS: every {{60}} minutes write CHECKPOINT-<n>.md on branch flotilla/p1-report: per unit status, last test output tail, usage consumed so far, any child stuck >30 min (message it once; if no progress in 20 more minutes, put it to sleep and mark BLOCKED).
- DRIFT GUARD: at every checkpoint compare each child's `git diff --stat` to its DIFF BUDGET and SCOPE. Over budget or out of scope -> message the child to revert, once.
- STOP CONDITIONS (stop spawning, let running children finish their current step, then write the report): any child status shows a usage/credit/quota limit; total spend >= {{LIMIT}}; `make check` red on flotilla/p1; {{3}} children BLOCKED; hard-stop time reached.
- NEVER merge, enable auto-merge, push to main or flotilla/p1, force-push, or deploy. PRs against flotilla/p1 only.

MORNING REPORT (RUN-REPORT.md in a PR against flotilla/p1, and the final message):
1. 5-line headline: units DONE / BLOCKED / NEEDS-HUMAN, total usage.
2. Table: unit | status | PR | `make check` tail | diff stat | verified-by-orchestrator (yes/no).
3. "I need you to decide": numbered, one line each, with my recommendation.
4. Unverified items and risks.
5. Next wave proposal (units + scopes), not started.
```

### 3d. Review / fix session

```text
REVIEW then FIX PRs {{PR URLs}} in {{OWNER/REPO}}. Target branch flotilla/p1.
Phase 1, read-only. For each PR: check out the branch, run `make check` and the unit's DONE SIGNAL, read the full diff, and score:
- Does it meet the unit GOAL and only that? Anything outside SCOPE or over DIFF BUDGET?
- Do the tests assert behaviour, or were they weakened/skipped/deleted? Is output real?
- Secrets, keys in .env.example, license issues (no AGPL in core), invented claims in comments/docs.
- Blast radius: what else imports what changed? Does a simpler diff exist?
Verdict per PR: KEEP / FIX / DROP, with evidence (commands + output). Post as a PR-level summary in this session, not as GitHub comments unless I say so.
Phase 2, only for FIX: apply only the listed fixes as new commits on the same branch. Max 2 fix loops per PR; after that mark NEEDS-HUMAN. Re-run `make check` each loop and paste output.
Never merge, never approve-and-merge, never push to main or flotilla/p1, never force-push. End with a verdict table.
```
Add Devin Review as a second pair of eyes: it reviews PRs, has Auto-Fix so the session that opened a PR can act on findings, and `devin_review_manage` can trigger it from MCP/API. [V S15, S12] Auto-fix loops need a cap: say "max 2 rounds" in the prompt [I].

---

## 4. API-driven fan-out

### 4A. Cloud API (Devin v3)

**Plan check.** The API exists. Whether **your Max plan** can create API keys is **not verified**: docs describe service users (org/enterprise) and Personal Access Tokens "within your Teams account or your enterprise" [V S8]; a third-party spec sheet lists API under Pro [3P DBotMaker https://dbotmaker.io/review/devin]; the pricing page's Max row had no readable API tick in my fetch [V S19, unreadable]. **Check Settings > Devin API.** If you see a PATs tab, you can proceed. If not, use 4B.

Verified API facts [V S7, S8]:
- `POST https://api.devin.ai/v3/organizations/{org_id}/sessions`, header `Authorization: Bearer cog_...`.
- Body fields (all verified in the OpenAPI): `prompt` (required), `title`, `repos[]`, `tags[]`, `playbook_id`, `child_playbook_id`, `knowledge_ids[]`, `secret_ids[]`, `max_acu_limit` (integer), `structured_output_schema` (JSON Schema, max 64KB), `structured_output_required`, `resumable`, `memory_enabled`, `platform`, `devin_mode`, `bypass_approval`.
- **`devin_mode` has NO SWE-2.1 value.** Enum: normal, fast, fusion, lite, ultra, fast-ultra, swe-2-medium, swe-2-high, swe-2-max. So the API cannot pin SWE-2.1; omit `devin_mode` and rely on the account default agent (3B step 2). The response's `devin_mode` is "None when the session runs an agent preview that has no mode equivalent," so expect null for SWE-2.1 preview [V S7 + I].
- Status values: `new, claimed, running, exit, error, suspended, resuming`. `status_detail` includes `working, waiting_for_user, waiting_for_approval, finished, usage_limit_exceeded, out_of_credits, out_of_quota, no_quota_allocation, total_session_limit_exceeded`. Responses include `session_id`, `url`, `acus_consumed`, `pull_requests`, `structured_output`, `child_session_ids`. [V S7]
- `max_acu_limit` is documented as an ACU integer; what it means on Max (a quota-metered plan) is **unverified** [I]. Use it only as an extra stop, and keep the real cap in Settings.
- HTTP 429 exists for rate limits; the limit values are not documented in what I read. [V S24]

Script (saved at `/workspace/flotilla/scripts/devin_fanout.py`). Stdlib only, **dry-run by default**, hard cap on sessions, stops on any quota-type `status_detail`. I tested only the dry-run path (no network calls, nothing sent to Devin).

```python
#!/usr/bin/env python3
"""Launch N Devin sessions from units.json. Dry-run unless --go. Stdlib only.

env: DEVIN_API_KEY (cog_... PAT or service-user key), DEVIN_ORG_ID
units.json: [{"id":"u01-core-types","prompt":"...","branch":"flotilla/u01-core-types"}, ...]
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

BASE = "https://api.devin.ai/v3"

def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": "Bearer " + os.environ["DEVIN_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method} {path}: {e.read().decode()[:300]}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("units")
    ap.add_argument("--repo", required=True, help="owner/repo of YOUR fork")
    ap.add_argument("--tag", required=True, help="batch tag, e.g. flotilla-p1-night1")
    ap.add_argument("--max", type=int, default=3, help="hard cap on sessions launched")
    ap.add_argument("--acu", type=int, default=None, help="max_acu_limit per session (unit unverified on Max)")
    ap.add_argument("--mode", default=None, help="devin_mode; omit to use account default")
    ap.add_argument("--go", action="store_true", help="actually create sessions")
    ap.add_argument("--wait", action="store_true", help="poll until all settle")
    a = ap.parse_args()

    units = json.load(open(a.units))[: a.max]
    org = os.environ.get("DEVIN_ORG_ID", "<DEVIN_ORG_ID>")
    schema = {
        "type": "object",
        "properties": {
            "branch": {"type": "string"},
            "pr_url": {"type": "string"},
            "tests_passed": {"type": "boolean"},
            "summary": {"type": "string"},
            "unverified": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["branch", "tests_passed", "summary"],
    }
    made = []
    for u in units:
        body = {
            "title": u["id"],
            "prompt": u["prompt"],
            "repos": [a.repo],
            "tags": [a.tag, u["id"]],
            "structured_output_schema": schema,
        }
        if a.acu is not None:
            body["max_acu_limit"] = a.acu
        if a.mode:
            body["devin_mode"] = a.mode
        if not a.go:
            print(f"[dry-run] POST /organizations/{org}/sessions", json.dumps({**body, "prompt": body["prompt"][:80] + "..."}))
            continue
        s = call("POST", f"/organizations/{org}/sessions", body)
        made.append(s["session_id"])
        print(u["id"], s["session_id"], s.get("url"))
        time.sleep(2)

    if a.go and a.wait and made:
        pending = set(made)
        while pending:
            time.sleep(120)
            for sid in list(pending):
                s = call("GET", f"/organizations/{org}/sessions/{sid}")
                d = s.get("status_detail")
                print(sid, s["status"], d, s.get("acus_consumed"))
                if d in ("usage_limit_exceeded", "out_of_credits", "out_of_quota",
                         "no_quota_allocation", "total_session_limit_exceeded"):
                    sys.exit(f"STOP: {sid} hit {d}. Not launching or waiting on more.")
                if s["status"] in ("exit", "error", "suspended") or d in ("finished", "waiting_for_user", "waiting_for_approval"):
                    pending.discard(sid)

if __name__ == "__main__":
    main()
```

Usage:

```bash
export DEVIN_API_KEY=cog_...   # from Settings > Devin API. Never paste it in a prompt or commit it.
export DEVIN_ORG_ID=...        # top of Settings > Devin API
python3 devin_fanout.py units.json --repo OWNER/REPO --tag flotilla-p1-n1 --max 2            # dry run
python3 devin_fanout.py units.json --repo OWNER/REPO --tag flotilla-p1-n1 --max 2 --go --wait  # real, 2 sessions
```

`units.json`: `[{"id":"u01-core-types","prompt":"<paste the worker prompt 3b with the unit file path filled>"}, ...]`. Each prompt must carry the full guardrails (branch, PR target, no merge), because API sessions get no orchestrator.

### 4B. Without the API: scripted CLI (verified commands)

- `devin --cloud -p "<prompt>"` starts a **cloud** session, sends one prompt, prints the response and exits; the session keeps running; resume with `devin --cloud -r <url>`. `--model <MODEL>` sets the model; `--prompt-file <FILE>` loads a prompt. [V S21]
- **Local and free through Dec 8 (Desktop/CLI promo):** `devin --model <swe-2.1 name> --permission-mode ... -p "<prompt>"` in a separate `git worktree` per unit. The exact model slug for SWE-2.1 Max was not on the pages I read; run `/model` to see the list. [V S3, S21; slug unverified] Non-interactive mode fails in untrusted directories unless `--respect-workspace-trust false`. [V S21] Permission modes include a `dangerous`/bypass mode; do not use it outside a disposable VM. [V S21]
- CLI subagents: ask in the prompt ("research X in an explore subagent"). Profiles: `subagent_explore` (default subagent model, cheaper), `subagent_general` (same model as parent, so costs like a full extra session). You can't name a model in a prompt; pin one in a custom subagent file. Docs say subagents improve performance and reduce cost in their tests, but fan-out multiplies spend. [V S13]
- `/handoff` moves a local CLI session (branch, context, uncommitted diff) to a cloud session and back. [V S21]
- Local runs need an always-on machine; closing the laptop stops them. Cloud sessions keep running when you close the terminal. [V S21 for cloud; I for local]

### 4C. Driving Devin from another agent (MCP)

`https://mcp.devin.ai/mcp` with `Authorization: Bearer cog_...`. Tools: `devin_session_create` (several at once; prompt/title/playbook/tags/ACU limit), `devin_session_search`, `devin_session_interact` (message, sleep, terminate, archive), `devin_session_events`, `devin_session_gather` (wait for many sessions to settle in one call), plus playbook/knowledge/schedule/automation/review tools. [V S12] Useful if your Grok bot or Cursor agent should be the captain and Devin the crew. Same Max-plan key question as 4A.

---

## 5. Models: SWE-2.1 Max vs SWE-2

| | SWE-2.1 | SWE-2 |
|---|---|---|
| Levels | Low, Medium, High, XHigh, Max | Medium, High, Max |
| Cloud | preview through Dec 22, 2026 | research preview (since Sep 21) |
| Cognition's own scores (self-reported) | FrontierCode 2.0 41.3, Terminal-Bench 4.1 50.0, SWE Marathon v1.2 54.9 | 24.1, 24.2, 32.5 |

Scores are from Cognition's blog [V S4] and are vendor numbers. Cognition says 2.1 was trained for long-horizon work and improves with more test-time compute. [V S4]

- **Orchestrator + hard units: SWE-2.1 Max.** Fewer wrong turns when nobody watches. [I]
- **Routine units (rename, glue, tests-only): High or XHigh** to save quota if cloud is metered. [G]
- **SWE-2 only** if the 2.1 preview misbehaves or disappears in cloud. [I]
- Orchestrator model inheritance: the API field doc says a session's mode is resolved from "org/user defaults and parent-session inheritance", so children likely follow the parent. [V S7 + I] Say the model in the prompt and confirm in each child's session header.
- Devin Lite is cheaper and can be pinned for per-item classification inside workflows. [V S2]

---

## 6. Guardrails

**Secrets**
- No keys in prompts, repo, `.env.example`, or logs. Use Settings > Secrets if ever needed. [V S11]
- Prompt line: "Never print secrets." (already in templates). Keep the Devin API key and `cog_` tokens out of shell history and chat.
- Optional: `memory_enabled:false` on API sessions so nothing is learned into memory. [V S7]

**Budget**
- Max = included weekly quota, then on-demand credits. Empty balance pauses sessions. [V S5] So: **auto-reload off, small on-demand balance, default session spending limit set.**
- **Devin Bots have no separate limit on Max.** They bill to your quota then credits. [V S14] If you use a Bot as captain, watch it manually. One third-party beta report: a leftover "surprise me" routine burned a subscription overnight, and a Bot kept asking for review despite instructions. [3P https://www.rickblalock.dev/scratch-notes/learnings-from-moving-my-grok-bots-to-devin-bots/]
- Every managed child and every workflow agent is a full session; "one run can consume far more ACUs than doing the same task in a single session." Test a slice first. [V S2]
- Start with 2 children, then 4, then more. Concurrency limit on Max is **unverified**: pricing page shows "Up to 10" for the Pro/Max-area row [V S19, ambiguous table]; a power-user post says up to 4 on $200 [3P S18].
- Session limits: no hard session-length cap found in docs. Workflow run budget: 7 days. [V S2] Idle sleep after 5 min (30 min on Windows/GPU). [V S6]

**Branch rules**
- Prompt rule plus GitHub branch protection on main. The prompt is not enforcement. [I]
- Archiving a parent session also closes open PRs of the child sessions archived with it: **do not archive the orchestrator until you have merged or copied what you need.** [V S16]
- Devin auto-fixes merge conflicts on its PRs within 12h of session activity (36h if approved). Expect extra pushes to branches you did not ask it to touch again. [V S16]
- Children can't see each other's files. Parallel units must own disjoint files. [V S2, I]

**Stop conditions** (all already in 3a/3c): quota/credit `status_detail`; spend cap; red integration branch; 3 BLOCKED units; same-file collision; hard-stop time; child over diff budget twice.

**Known failure modes** [V S15 unless noted]
- Open-ended or vague goals: Devin gets stuck or picks a solution you did not want. Be opinionated.
- No feedback loop: without tests/lint/CI it cannot tell it is wrong.
- Long sessions degrade; too large a task burns usage limits repeatedly ("might be too complex").
- Broken environment: if Devin struggles to build/test, fix the blueprint, not the prompt.
- Cost blowups from many children or nested subagents. [V S13, S2]
- Child summaries can be optimistic; verify by running the branch (3a step 7). [I]
- CI-fix / review-fix loops can ping-pong; cap rounds. [I] (Capy's own eval found some review-fix loops do not converge, per your brief; not Devin-specific.)

---

## 7. Open questions and unverified

1. **Is SWE-2.1 free in cloud sessions?** Docs/blog say no (Desktop+CLI only); @cognition/@devindevelopers posts say yes. Test with one session (section 1 step 1).
2. Cloud concurrency on Max: 4 vs "up to 10"? Unresolved.
3. Max weekly quota size: no number found in docs I read. Check Settings > Usage & limits.
4. Can a Max account create API keys / PATs? Check Settings > Devin API.
5. Exact CLI slug for SWE-2.1 Max; whether the Slack `!swe2` keyword has a 2.1 sibling. Not found.
6. Does `max_acu_limit` apply to Max (quota) accounts, and in what unit?
7. Docker-in-Devin for Flotilla's compose tests: untested.
8. Do your pstack skills load unchanged as Devin skills? Guess: yes.
9. VM size: one X user says 8 vCPU / 32 GB [3P S18 mirror, @dabit3]; not in docs I read.
10. Whether the SWE-2.1 cloud preview ends Dec 22 or is extended after Jan 30 pricing: unpublished. [V S3 says only preview through Dec 22; Which Model HQ: "what it meters at after Jan 30 has not been published."]
11. Devin Dynamic Workflows on a self-serve plan: docs say "available in any Devin session"; the off-by-default switch is for Enterprise. [V S2] I did not verify a Max-specific restriction.

---

## 8. Sources

- S1 https://docs.devin.ai/work-with-devin/advanced-capabilities.md (managed Devins, triggers, auto-approve child sessions)
- S2 https://docs.devin.ai/work-with-devin/dynamic-workflows.md
- S3 https://docs.devin.ai/desktop/models (promo terms, levels, cloud preview)
- S4 https://cognition.com/blog/swe-2-1 (banner "Free through 12/8 on Desktop and CLI", scores)
- S5 https://docs.devin.ai/admin/billing/self-serve.md
- S6 https://docs.devin.ai/admin/billing/usage.md
- S7 https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions.md
- S8 https://docs.devin.ai/api-reference/authentication.md, https://docs.devin.ai/api-reference/personal-access-tokens.md, https://docs.devin.ai/api-reference/getting-started/teams-quickstart.md
- S9 https://docs.devin.ai/onboard-devin/agents-md.md
- S10 https://docs.devin.ai/product-guides/skills.md ; S10b https://docs.devin.ai/onboard-devin/knowledge-onboarding.md (Knowledge deprecated)
- S11 https://docs.devin.ai/onboard-devin/environment.md, .../environment/blueprints.md
- S12 https://docs.devin.ai/work-with-devin/devin-mcp.md
- S13 https://docs.devin.ai/cli/subagents.md
- S14 https://docs.devin.ai/work-with-devin/bots.md, https://docs.devin.ai/work-with-devin/bots/usage-limits.md
- S15 https://docs.devin.ai/essential-guidelines/when-to-use-devin.md, .../instructing-devin-effectively.md
- S16 https://docs.devin.ai/release-notes/overview.md (child-session PR archive behaviour; merge-conflict autofix window; auto-merge in Review)
- S17 https://docs.devin.ai/use-cases/gallery/batch-test-coverage (8 parallel overnight sessions pattern)
- S18 https://x.latent.space/yongquanYQ (mirror of @yongquanYQ's X posts, includes @cognition Nov 24 post and @dabit3)
- S19 https://devin.ai/pricing
- S20 https://news.sulat.com/2026/11/25/devin-swe-2-1/ (quotes @devindevelopers)
- S21 https://docs.devin.ai/cli/cloud.md, https://docs.devin.ai/cli/handoff.md, https://docs.devin.ai/cli/reference/commands.md
- S22 https://docs.devin.ai/get-started/first-run.md (agent selector, SWE-2.1 preview through Dec 22)
- S23 https://docs.devin.ai/learn-about-devin/prompting ("performance can sometimes degrade as the session gets longer")
- S24 https://docs.devin.ai/api-reference/overview.md (429 listed)
- Also read: https://cognition.com/blog/devin-can-now-manage-devins (Mar 19, 2026), https://devin.ai/blog/introducing-devin-bots, https://docs.devin.ai/llms.txt index.
