#!/usr/bin/env python3
"""Usage: gen_parity.py --write SPEC.md. Generate SPEC.md §2 summary + Appendix A (parity map) from research/CAPY.md §15b. Re-run after CAPY.md changes."""
import re, sys, collections
import os
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research", "CAPY.md")
rows = []
for line in open(SRC, encoding="utf-8"):
    if not line.startswith("| CAPY-"):
        continue
    # split on unescaped pipes only, then unescape (CAPY.md cells contain `\|`, e.g. CAPY-251 "curl\|sh")
    cells = [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line.strip().strip("|"))]
    rid, area, feat, src, label = cells[:5]
    note = cells[5] if len(cells) > 5 else ""
    rows.append(dict(id=rid, n=int(rid[5:]), area=area, feat=feat, label=label, note=note))

# Area -> (Flotilla component, default phase)
AREA = {
 "Threads": ("Thread + event log + web UI", "P2"),
 "Wakes & background": ("Wake router (event subscriptions + DB-backed timers; pg-boss from P2)", "P2"),
 "Subagents & forks": ("Child Thread (parentId) via adapter-native subagents or Flotilla delegate", "P2"),
 "Captains": ("Captain scheduler + Captain Drive files", "P2"),
 "Issues": ("Built-in issues (Postgres) or GitHub/Linear issues", "P3"),
 "Pull requests & autofix": ("GitHub integration + PR ownership + autofix loop", "P2"),
 "Review": ("Review agent = a read-only Thread on the PR head", "P2"),
 "Automations": ("Automation (pg-boss cron / webhook / GitHub triggers, P2) that starts Threads", "P2"),
 "Projects": ("Project (repo + defaults)", "P2"),
 "Environment & snapshots": ("Machine image + setup script + container snapshot (docker commit)", "P2"),
 "Cloud machines": ("Machine pool: Docker container per thread on the compose host", "P2"),
 "Previews": ("Preview proxy (P1: server's own :8081 origin via the gate; P2: Caddy wildcard hosts)", "P2"),
 "Devices & desktop app": ("flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user", "P2"),
 "Dock CLI": ("flotilla-runner CLI (headless pairing)", "P2"),
 "Cloud phones": ("Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)", "P4"),
 "Drive": ("DriveItem store (Postgres + files volume), mounted into threads", "P2"),
 "Instructions & rules": ("Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules)", "P2"),
 "Skills": ("Skills folder mounted into thread (agent-native skills)", "P2"),
 "MCP & plugins": ("MCP registry, passed to adapters as MCP config", "P2"),
 "Models & connections": ("AgentAdapter + per-user connections (vendor login inside the CLI, or API keys)", "P2"),
 "Billing & plans": ("n/a: Flotilla is self-hosted and has no billing", "n/a"),
 "Usage & analytics": ("Cost ledger (per-thread CostEntry) + usage page", "P2"),
 "Org, members & access": ("Org/members/roles (multi-user)", "P3"),
 "SSO & sign-in": ("Auth: local accounts + OIDC SSO", "P3"),
 "Security & data": ("Kernel + self-hosted data", "P2"),
 "Secrets": ("Secrets vault (encrypted at rest, scrubbed from output)", "P2"),
 "Cloud credentials (OIDC)": ("Flotilla as OIDC issuer per thread", "P4"),
 "GitHub": ("GitHub App / PAT integration", "P2"),
 "Slack": ("Slack app", "P3"),
 "Linear": ("Linear agent session integration", "P3"),
 "Other integrations": ("Integrations (Vercel/Paper/etc.)", "P3"),
 "UI surfaces": ("Web UI", "P3"),
 "Keyboard shortcuts": ("Web UI shortcuts", "P3"),
 "Notifications": ("Notifications (web push / email / Slack)", "P3"),
 "API (platform)": ("Public REST + SSE API", "P2"),
 "Support": ("Docs", "P2"),
}
API_PREFIX = ("Public REST + SSE API", "P2")

# Every P1 row -> the P1 handoff unit(s) that build it (handoffs/phase1-NN-*.md). The script fails if a P1 row has no unit.
P1_UNITS = {
 1:"02,11,12", 2:"11", 3:"08,11,12", 5:"11,13", 6:"11,13", 8:"11,13", 13:"02,11,12", 14:"03,11,13", 25:"11,12",
 35:"11", 36:"11", 37:"14", 66:"16,17", 71:"17", 79:"17", 83:"16,17", 86:"17", 97:"03,16",
 108:"09,14", 109:"03,09", 118:"14", 119:"14", 128:"14", 129:"14", 176:"02,08,13",
 198:"05", 199:"05", 220:"15", 222:"15", 319:"06,07", 321:"05,06,11", 322:"06", 349:"03,11,13", 356:"11,12",
 375:"01", 376:"02", 377:"09", 378:"03,11", 379:"01", 398:"09,14", 480:"03,11",
 536:"08", 537:"08", 541:"08", 542:"11", 543:"08", 599:"08", 600:"11", 602:"11", 608:"02",
}
P1 = set(P1_UNITS)
OVR_PHASE = {  # explicit non-default phases
 120:"P2", 204:"P2", 206:"P2", 346:"P2",            # REVIEW-2 F-20: not built in P1
 147:"P4", 237:"P3", 238:"P3", 239:"P3", 423:"P2",  # REVIEW-2 F-21
 42:"P3", 156:"P3", 157:"P3", 158:"P3", 174:"P3", 483:"P3", 494:"P3",   # Slack/Linear are P3
 87:"P3", 89:"P3", 167:"P3", 168:"P3", 242:"P3", 243:"P3", 304:"P3", 306:"P3", 334:"P3", 482:"P3", 487:"P3",  # multi-user is P3
 227:"P3", 241:"P3", 247:"P3", 248:"P3", 489:"P3", 491:"P3", 441:"P3",
 538:"P2", 539:"P2", 540:"P2", 635:"P2", 636:"P2", 637:"P2", 639:"P2",
 350:"P3",
 200:"P3", 201:"P2", 208:"P3", 214:"P2", 216:"P3", 219:"P2", 222:"P2",
 121:"P3", 122:"P3", 124:"P3", 127:"P3", 115:"P2", 116:"P3",
 11:"P4", 31:"P3", 30:"P3", 29:"P3", 28:"P3",
 93:"P3", 95:"P2", 96:"P2",
 312:"P4", 313:"P3", 314:"P3", 315:"P3", 316:"P3",
 323:"P3", 324:"P3", 326:"P3",
 341:"P2", 481:"P2",
 380:"P2",
 354:"P3", 355:"P3",
}
NA = {
 217:"Capy billing page row; Flotilla shows machine cost estimates in the cost ledger instead (CAPY-341).",
 320:"Capy's ad-funded free models are a Capy business deal; nothing to self-host.",
 486:"Regional expansion of Capy's ad-funded free models (same reason as CAPY-320).",
 339:"Capy plans; Flotilla has no plans.", 340:"Capy pricing promo.", 342:"Capy review credits; Flotilla review runs on the user's own agents.",
 343:"Seat policy of a SaaS; self-host has no seats.", 344:"Stripe top-ups; no billing.", 345:"Credit sources; no credits.",
 347:"Invoices/receipts; no billing.", 348:"Sponsored allowance; no billing.", 351:"Credit programs; no billing.", 373:"SSO price add-on; SSO is free in Flotilla (P3).",
 374:"SOC 2/DPA are company certifications, not features; self-host keeps data with the operator.",
 381:"Published egress IPs are a SaaS concern; self-host uses the operator's own IPs.",
 463:"Capy's support desk; Flotilla uses GitHub Discussions/docs (CAPY-464).",
 613:"Review billing transfer (API); no billing.", 614:"Review billing transfer (API); no billing.",
 615:"Review billing transfer (API); no billing.", 616:"Review billing transfer (API); no billing.",
 617:"Review billing transfer (API); no billing.",
 146:"Review billing transfer between orgs; no billing (same as CAPY-613..617).",
}
REPLACED = {
 68:"P2: promote keeps history, PRs, machine, model and members; the Slack-thread part arrives with Slack (P3).",
 95:"P2: Captains on a schedule via automations; Slack hand-off of tickets arrives with Slack (P3).",
 295:"P2: invoke skills with $, /, @ or plain words in the web UI; `$name` in Slack arrives with Slack (P3).",
 199:"P1: replaced. Non-root user **without** sudo (cap-drop ALL + no-new-privileges); repos under /workspace; extra packages via image build args (P1) or setup scripts (P2).",
 128:"P1: webhook delivers at once; polling fallback every 60 s per open PR with pending checks (works without a public URL).",
 129:"P1: the server fetches the failing job log (truncated, untrusted) into the wake; agent-triggered re-runs of Actions jobs are P2.",
 319:"P1: no hard-coded default model; the adapter's own default (model null) unless the user picks one.",
 220:"P1: expose a port → `http://<host>:8081/p/<code>/<port>/`, the server's own proxy on a separate origin, dialled through the gate; private by default.",
 83:"P1: only DIGEST.md, stored on the Captain row (`digestMd`); the full Captain Drive (AGENTS.md, CREW.md, NOTES.md, skills/, …) is P2.",
 341:"P2: machine time is metered as `machineSec` in the cost ledger with an operator-set cost per runner type; no billing.",
 481:"P2: when a connection runs out, ask before switching engine (Approval); never a silent downgrade; no billing.",
 227:"P3: replaced. Installable web app (PWA) instead of native desktop builds; `flotilla-runner` stays a headless CLI.",
 241:"P3: replaced. The headless runner (systemd/launchd service) keeps a machine online; no tray app.",
 247:"P3: replaced. Browser tabs/windows of the web UI; split panes in the web UI.",
 248:"P3: replaced. Runner logs stay on the machine; `flotilla-runner logs --export`.",
 489:"P3: replaced. 'Open in editor' links (vscode://, cursor://) from the web UI.",
 491:"P3: replaced. Unread count in the PWA badge / page title.",
 441:"P3: replaced. Responsive web UI / PWA; no native iOS app.",
 350:"P3: Personal vs Team = a single-user install vs an org (CAPY-357+); no billing attached.",
 222:"P1: inverted. Previews are private by default (preview-only token cookie on a separate origin, SPEC §6c); share = signed expiring link.",
 3:"P1: web UI and API only; Slack/Linear/@mention starts in P3.",  # in scope, but Flotilla does it differently
 321:"P1: official CLIs log in through their own flow; each user's `claude auth login` state lives on a per-user volume mounted only into that user's threads (server never reads it; never proxied off the operator's infra). Anthropic-terms interpretation of a host volume is a known unverified risk (SPEC §15). [NOCLAUDE]",
 322:"P1: Claude runs as the official `claude` CLI (`-p --output-format stream-json`) via the claude-code adapter, not the Agent SDK.",
 376:"P1: inverted. All transcripts and events stay in the operator's Postgres [TX].",
 377:"P1: thread containers hold no GitHub token and have no route to GitHub; the server pushes from its own bare mirror fed by a git bundle, hooks off (SPEC §6a).",
 378:"P1: kernel secret scrubber on every event before it is stored or shown (fixes a Capy gap).",
 379:"P1: no telemetry at all; nothing phones home.",
 97:"P1: replaced by kernel-enforced hard caps (tokens/$/threads/concurrency) that pause and ask [CAP].",
 349:"P1: cap-hit pause card (Approval kind `budget`) with Raise cap / Stop.",
 480:"P1: thread pauses with Approval kind `budget`, resumes after the human answers [CAP].",
 346:"P2: monthly window on the global/project budget (`BudgetPolicy.window`); P1 has lifetime caps the operator raises [CAP].",
 198:"P1: Docker container (hardened) instead of Firecracker microVM; gVisor/Kata P3, Firecracker P4.",
 375:"P1: self-host is the default; ZDR is the operator's choice of model provider.",
}

def phase(r):
    n=r["n"]
    if n in NA: return "n/a"
    if n in P1: return "P1"
    if n in OVR_PHASE: return OVR_PHASE[n]
    if r["area"].startswith("API:"):
        return "P2" if r["area"].split(":")[1].strip() in {"threads","messages","streams","captains","automations","subagents"} else "P3"
    return AREA.get(r["area"], ("?", "P2"))[1]

def equiv(r):
    n=r["n"]
    if n in NA: return "n/a: " + NA[n]
    unit = f" (units {P1_UNITS[n]})" if n in P1_UNITS else ""
    if n in REPLACED: return REPLACED[n] + unit
    comp = API_PREFIX[0] if r["area"].startswith("API:") else AREA.get(r["area"], ("?",))[0]
    note = r["note"].strip()
    return comp + (f"; {note}" if note else "") + unit

def esc(s): return s.replace("|", "\\|")
out = []
counts = collections.Counter()
for r in rows:
    p = phase(r); counts[p]+=1
    out.append(f"| {r['id']} | {esc(r['area'])} | {esc(r['feat'])} | {esc(equiv(r))} | {p} |")
total = len(rows)
# consistency checks (REVIEW-2 F-21): fail loudly instead of drifting
errs = []
ids = {r["n"] for r in rows}
errs += [f"P1_UNITS has unknown row CAPY-{n:03d}" for n in P1_UNITS if n not in ids]
for r in rows:
    p, n, f = phase(r), r["n"], r["feat"]
    if p == "P1" and n not in P1_UNITS: errs.append(f"CAPY-{n:03d} is P1 but has no P1 unit")
    if p in ("P1", "P2") and n not in REPLACED and re.search(r"\b(Slack|Linear)\b", f) and not re.search(r"\b(GitHub|web|API)\b", f):
        errs.append(f"CAPY-{n:03d} is {p} but needs Slack/Linear (P3)")
    if p in ("P1", "P2", "P3") and n not in REPLACED and re.search(r"cloud phone|iOS simulator|Android", f):
        errs.append(f"CAPY-{n:03d} is {p} but needs mobile QA (P4)")
    if equiv(r).startswith("n/a") != (p == "n/a"): errs.append(f"CAPY-{n:03d}: phase {p} vs equivalent '{equiv(r)[:30]}'")
if errs:
    sys.stderr.write("\n".join(errs) + f"\n{len(errs)} consistency errors\n"); sys.exit(1)
hdr = ["## Appendix A. Full parity map (every CAPY-### row)", "",
 f"Generated by `scripts/gen_parity.py` from `research/CAPY.md` §15b ({total} rows). Phase counts: " + ", ".join(f"{k} {counts[k]}" for k in ["P1","P2","P3","P4","n/a"]) + ".",
 "The 'Flotilla equivalent' column is a design decision [I]; the Capy feature column is copied from CAPY.md and keeps its labels and sources there.", "",
 "| ID | Area | Capy feature | Flotilla equivalent | Phase |", "|---|---|---|---|---|"]
appendix="\n".join(hdr+out)+"\n"
by_area=collections.OrderedDict()
for r in rows:
    a="API (endpoints)" if r["area"].startswith("API:") else r["area"]
    by_area.setdefault(a,collections.Counter())[phase(r)]+=1
PH=["P1","P2","P3","P4","n/a"]
summ=["| Area | "+" | ".join(PH)+" |","|---|"+"---|"*len(PH)]
for a,k in by_area.items(): summ.append(f"| {a} | "+" | ".join(str(k.get(p,"")) for p in PH)+" |")
summ.append("| **Total** | "+" | ".join(f"**{counts[p]}**" for p in PH)+" |")
summary="\n".join(summ)+"\n"
if len(sys.argv)>2 and sys.argv[1]=="--write":
    t=open(sys.argv[2],encoding="utf-8").read()
    def put(t,tag,body):
        b,e=f"<!-- {tag}:BEGIN -->",f"<!-- {tag}:END -->"
        i,j=t.index(b)+len(b),t.index(e)
        return t[:i]+"\n"+body+t[j:]
    t=put(t,"PARITY-SUMMARY",summary); t=put(t,"APPENDIX-A",appendix)
    open(sys.argv[2],"w",encoding="utf-8").write(t)
else:
    sys.stdout.write(summary+"\n"+appendix)
sys.stderr.write(f"{total} rows; {dict(counts)}\n")
