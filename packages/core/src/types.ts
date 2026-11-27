// ---------- ids ----------
type ThreadId = `thr_${string}`;   type CaptainId = ThreadId;      // a Captain is a Thread with role "captain"
type RunId = `run_${string}`;      type MachineId = `mac_${string}`;
type EventId = `evt_${string}`;    type ApprovalId = `apr_${string}`;
type AutomationId = `aut_${string}`; type DriveItemId = `drv_${string}`;
type ProjectId = `prj_${string}`;  type UserId = `usr_${string}`;
type AdapterId = "claude-code" | "codex" | "cursor" | "gemini" | "acp" | "devin" | "generic-cli" | "native" | "fake";
type MicroUsd = number; type Tokens = number;

// ---------- Thread ----------
type ThreadStatus = "queued" | "working" | "waiting" | "paused" | "idle" | "failed" | "archived";
interface Thread {
  id: ThreadId;
  code: string;                       // "FLO-14" (CAPY-016)
  projectId: ProjectId | null;        // null = no-repo thread (CAPY-032)
  role: "thread" | "captain";
  parentId: ThreadId | null;          // subagent parent (CAPY-052)
  crewOf: CaptainId | null;           // one crew at a time (CAPY-074)
  ownerId: UserId;
  title: string;
  status: ThreadStatus;
  needsYou: ApprovalId[];             // open approvals; separate from status (CAPY-014)
  engine: { adapter: AdapterId; model: string | null; effort: string | null; connectionId: string | null };
  machineId: MachineId | null;
  branch: string | null;              // flotilla/<code>-<slug>; never a protected branch (kernel)
  prs: { repo: string; number: number; owned: boolean }[];  // owned = last pusher (CAPY-119)
  budget: BudgetPolicy;
  spent: CostTotals;                  // projection of CostEntry rows
  createdAt: string; updatedAt: string;
}

// ---------- Captain ----------
interface Captain extends Thread {
  role: "captain";
  captain: {
    purpose: string;                  // first message (CAPY-071)
    crewRunsOn: "pool" | MachineId;   // CAPY-092
    maxConcurrentCrew: number;        // P1 hard ceiling 5; kernel-enforced
    driveRoot: DriveItemId | null;    // P2 Drive (AGENTS.md, CREW.md, NOTES.md, DIGEST.md, CAPY-083); null in P1
    digestMd: string;                 // P1: DIGEST.md lives on the captain row (no Drive yet)
    hookBundle: { id: string; version: number } | null;  // §12
    wakePolicy: { heartbeatSec: [min: number, max: number]; coalesceSec: number };  // firstmate 600→7200, 30
  };
}

// ---------- User / Project (P1: single admin; orgs P3) ----------
interface User { id: UserId; email: string; role: "admin" | "member"; createdAt: string }
type ProjectTrust = "trusted" | "untrusted";   // untrusted (default; always for public or foreign repos) = no vendor-login volume, API key only (§6a)
interface Project {
  id: ProjectId; ownerId: UserId; name: string;
  repo: { provider: "github"; fullName: string; baseBranch: string };  // CAPY-176 (one repo in P1; ordered repos P2)
  trust: ProjectTrust;
  egressAllow: string[];              // extra hostnames threads may reach via the egress gate (§6a), e.g. "registry.npmjs.org"
  budget: BudgetPolicy;               // scope "project"
  createdAt: string;
}

// ---------- Run (one turn of one engine) ----------
type RunTrigger = "message" | "ci" | "review" | "conflict" | "timer" | "watch" | "crew" | "automation" | "resume";
interface Run {
  id: RunId; threadId: ThreadId; ordinal: number;
  trigger: { kind: RunTrigger; eventId: EventId | null };
  adapterSessionId: string | null;    // vendor session id for resume
  state: "starting" | "running" | "completed" | "cancelled" | "failed" | "paused_budget";
  startedAt: string; endedAt: string | null;
  usage: CostTotals;                  // this run only
  attempt: number;                    // retry counter (§13 retries)
}

// ---------- Machine ----------
type Isolation = "docker" | "docker-gvisor" | "docker-kata" | "os-user" | "remote-vendor"; // remote-vendor = Devin's VMs
interface Machine {
  id: MachineId;
  kind: "pool" | "byo";               // pool = containers on the compose host; byo = flotilla-runner
  name: string;
  isolation: Isolation;               // kernel refuses "none"
  os: "linux" | "darwin" | "windows";
  link: { via: "local" | "tailscale" | "ssh-reverse" | "direct"; lastSeenAt: string | null };
  capacity: { cpus: number; memMb: number; maxThreads: number };
  capabilities: { docker: boolean; kvm: boolean; gui: boolean; agents: AdapterId[] };
  state: "online" | "offline" | "draining";
  ownerId: UserId; shared: boolean;   // CAPY-219..: personal vs shared devices
}

// ---------- AgentAdapter (see §5 for the contract) ----------
interface AgentAdapterManifest {
  id: AdapterId; displayName: string;
  binary: string | null;              // null for API engines (devin)
  versionRange: string;               // semver range we tested against
  transport: "stdout-jsonl" | "json-rpc-stdio" | "acp" | "http-api" | "pty";
  capabilities: AdapterCapabilities;
  auth: AuthMethod[];
  costReporting: "usd" | "tokens" | "none";
  egressHosts: string[];              // hostnames the CLI needs (gate allowlist, §6a); unverified until the pre-launch smoke check
}
interface AdapterCapabilities {
  resume: boolean; cancel: boolean; steerMidTurn: boolean; nativeSubagents: boolean;
  vendorBudgetFlag: string | null;    // e.g. claude --max-budget-usd; second fence only
  hardCapSupported: boolean;          // false = usage arrives late or remotely (e.g. devin ACU lag): UI labels caps "soft"; reservation still applies
  mcp: boolean; images: boolean; planMode: boolean; permissionModes: string[];
}
type AuthMethod =
  | { kind: "vendor-login"; command: string[] }   // user runs it inside their own container/runner, e.g. ["claude","auth","login"]
  | { kind: "api-key"; envVar: string; baseUrlEnvVar?: string } // stored in Flotilla's secret vault, injected per run; baseUrlEnvVar carries a connection's Base URL
  | { kind: "none" };

// ---------- Event (append-only log; source of truth) ----------
type EventKind =
  | "thread.created" | "thread.status" | "run.started" | "run.ended"
  | "agent.message" | "agent.delta" | "agent.tool_call" | "agent.tool_result" | "agent.subagent"
  | "user.message" | "control.interrupt" | "control.stop"
  | "cost.entry" | "budget.warning" | "budget.exceeded"
  | "pr.opened" | "pr.pushed" | "ci.failed" | "ci.passed" | "pr.review" | "pr.conflict" | "pr.merged"
  | "crew.status"                    // done | needs-decision | blocked | failed | paused | captain-held | resolved (firstmate vocab); stale | wedged added in P2 (wedge ladder)
  | "approval.requested" | "approval.resolved"
  | "machine.state" | "preview.exposed" | "hook.applied" | "hook.rolled_back" | "kernel.denied";
interface Event {
  id: EventId; seq: number;           // per-thread monotonic
  threadId: ThreadId; runId: RunId | null;
  kind: EventKind;
  at: string;
  source: "kernel" | "adapter" | "user" | "github" | "captain" | "automation" | "hook";
  trust: "trusted" | "untrusted";     // PR bodies, issue text, CI logs = untrusted (§13)
  payload: unknown;                   // zod-validated per kind; scrubbed before insert
}

// ---------- Approval ("needs you") ----------
type AskKind = "conversation" | "decision" | "budget" | "merge" | "environment" | "mcp" | "credential" | "machine" | "hook-change";
interface Approval {
  id: ApprovalId; threadId: ThreadId; captainId: CaptainId | null;
  kind: AskKind;
  question: string;                   // says exactly what is needed (CAPY-015)
  options: { id: string; label: string }[];  // e.g. budget: raise | stop (raise carries answer.value)
  blocking: boolean;                  // true = thread is paused until answered
  state: "open" | "answered" | "dismissed" | "expired";
  answer: { optionId: string; value?: MicroUsd; by: UserId; at: string; note?: string } | null; // budget options are exactly "raise" (value = new cap) | "stop"
}

// ---------- Budget + cost ----------
interface BudgetPolicy {
  maxUsd: MicroUsd | null; maxTokens: Tokens | null; maxWallSec: number | null;
  scope: "thread" | "captain-subtree" | "project" | "global";
  onHit: "pause-and-ask";             // only option; kernel-fixed
  warnAt: number;                     // fraction, default 0.8
}
interface CostTotals { usd: MicroUsd; inputTokens: Tokens; outputTokens: Tokens; cacheTokens: Tokens; machineSec: number }
interface BudgetState {               // one level of the budget tree as the kernel sees it
  scope: BudgetPolicy["scope"]; scopeId: string;   // threadId | captainId | projectId | "global"
  policy: BudgetPolicy; spent: CostTotals; reserved: MicroUsd;   // reserved = sum of open holds
}
interface Hold { scope: BudgetPolicy["scope"]; scopeId: string; runId: RunId; amount: MicroUsd }
class KernelDenied extends Error {     // thrown by kernel guards; the caller emits a kernel.denied event
  constructor(readonly rule: "protected-branch" | "isolation" | "crew-limit" | "budget" | "scope", readonly detail: string) { super(`${rule}: ${detail}`); }
}
interface CostEntry {
  threadId: ThreadId; runId: RunId; at: string;
  source: "vendor-usd" | "token-estimate" | "machine-estimate";
  model: string | null; delta: CostTotals; priceTableVersion: string | null;
}

// ---------- Automation ----------
interface Automation {
  id: AutomationId; projectId: ProjectId | null; ownerId: UserId;
  trigger:
    | { kind: "schedule"; cron: string }                 // floor 5 min (CAPY parity)
    | { kind: "github"; events: string[]; filter?: string }
    | { kind: "webhook"; secretRef: string }             // HMAC-verified, not URL-as-secret
    | { kind: "manual" };
  target: { kind: "new-thread"; prompt: string; engine: Thread["engine"] } | { kind: "captain"; captainId: CaptainId; message: string };
  budget: BudgetPolicy; dailyRunCap: number; enabled: boolean;
}

// ---------- DriveItem ----------
interface DriveItem {
  id: DriveItemId; parentId: DriveItemId | null;
  scope: { kind: "org" } | { kind: "project"; id: ProjectId } | { kind: "captain"; id: CaptainId } | { kind: "user"; id: UserId };
  name: string; type: "file" | "folder";
  blobSha256: string | null; size: number;
  versions: { sha256: string; at: string; by: UserId | ThreadId }[];   // full history (Capy keeps 24 h)
  mountIntoThreads: boolean;          // rules/skills mounted read-only into containers
}


interface MachineCtx {                // what probe() may touch: run a read-only command on the target machine
  machineId: MachineId;
  exec(argv: string[], opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number }): Promise<{ code: number; stdout: string; stderr: string }>;
}
interface ProcessTransport {          // where an adapter's process runs; adapters never call child_process or Docker directly
  spawn(argv: string[], opts: { cwd: string; env: Record<string, string> }): ProcessHandle;
}
interface ProcessHandle {
  stdout: AsyncIterable<string>;      // line-split
  stderr: AsyncIterable<string>;
  exit: Promise<{ code: number | null; signal: string | null }>;
  signal(sig: "SIGINT" | "SIGTERM" | "SIGKILL"): Promise<void>;   // delivered to the whole process group
}
// LocalTransport (unit 04, tests) = child_process with detached:true, kill(-pgid).
// DockerExecTransport (unit 05) = `docker exec` of the in-container shim `/opt/flotilla/bin/flotilla-exec <runId> -- argv…`, which runs argv under
// `setsid`, records the pgid in /run/flotilla/<runId>.pgid, and forwards exit; signal() = a second exec `flotilla-exec --signal <runId> <SIG>` → kill -SIG -pgid.
// (Docker's exec API has no kill; closing the stream would orphan the agent.) The shim becomes flotilla-runner's process supervisor in P2.
interface AgentAdapter {
  manifest: AgentAdapterManifest;
  // Passive: never opens a session, runs hooks or starts MCP servers (rule from T3 Code [M] t3:docs/internals/03_providers.md:64-66)
  probe(ctx: MachineCtx): Promise<{ installed: boolean; version: string | null; authed: "yes" | "no" | "unknown" }>;
  start(input: StartInput): AsyncIterable<AdapterEvent>;            // first turn
  resume(input: ResumeInput): AsyncIterable<AdapterEvent>;          // next turn on adapterSessionId
  steer?(sessionId: string, text: string): Promise<"delivered" | "queued">; // only if capabilities.steerMidTurn
  cancel(runId: RunId): Promise<void>;                              // SIGINT → SIGTERM → SIGKILL (10 s) on the run's ProcessHandle
}
interface StartInput {
  threadId: ThreadId; runId: RunId; cwd: string; prompt: string; attachments: string[];
  model: string | null; effort: string | null;
  contextWindow?: number | null;      // tokens, from the catalog entry; adapters that can raise the window apply it
  mcpConfigPath: string | null; rulesPaths: string[];
  env: Record<string, string>;        // only secrets the thread was granted; never vendor login files
  auth: AuthMethod["kind"];           // chosen by the runner from Project.trust (§6a); claude adds --bare iff "api-key"
  vendorBudget: { maxMicroUsd: MicroUsd | null };  // the run's reservation; the adapter formats dollars for the vendor flag
  transport: ProcessTransport;
}
interface ResumeInput extends StartInput { adapterSessionId: string }
type AdapterEvent =
  | { t: "session"; adapterSessionId: string }
  | { t: "text"; delta: string } | { t: "message"; text: string }
  | { t: "tool_call"; id: string; name: string; input: unknown } | { t: "tool_result"; id: string; ok: boolean; output: string }
  | { t: "subagent"; id: string; title: string; state: string }
  | { t: "usage"; usdMicro?: MicroUsd; inputTokens?: number; outputTokens?: number; cacheTokens?: number; model?: string; cumulative: boolean }
      // adapters convert vendor dollars once, at the boundary: Math.round(usd * 1e6). cumulative = totals so far in this run (vs a delta)
  | { t: "ask"; kind: AskKind; question: string; options: { id: string; label: string }[] }
  | { t: "done"; stopReason: "end_turn" | "cancelled" | "max_turns" | "error" | "run_out"; error?: string };

export type {
  ThreadId,
  CaptainId,
  RunId,
  MachineId,
  EventId,
  ApprovalId,
  AutomationId,
  DriveItemId,
  ProjectId,
  UserId,
  AdapterId,
  MicroUsd,
  Tokens,
  ThreadStatus,
  Thread,
  Captain,
  User,
  ProjectTrust,
  Project,
  RunTrigger,
  Run,
  Isolation,
  Machine,
  AgentAdapterManifest,
  AdapterCapabilities,
  AuthMethod,
  EventKind,
  Event,
  AskKind,
  Approval,
  BudgetPolicy,
  CostTotals,
  BudgetState,
  Hold,
  CostEntry,
  Automation,
  DriveItem,
  MachineCtx,
  ProcessTransport,
  ProcessHandle,
  AgentAdapter,
  StartInput,
  ResumeInput,
  AdapterEvent
};
export { KernelDenied };
