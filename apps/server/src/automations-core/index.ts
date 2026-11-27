import { createHash, createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { Cron } from 'croner';
import { ApiFailure } from '../api-platform/types.js';
import { modelsCatalogStore } from '../models-catalog/store.js';

export type TriggerType = 'schedule' | 'github' | 'webhook' | 'manual';
export interface AutomationTrigger { type: TriggerType; cron?: string; timezone?: string; event?: string; batch?: boolean; hmac?: boolean }
export interface Automation {
  id: string; projectId: string; ownerId: string; name: string; prompt: string;
  triggers: AutomationTrigger[]; conditions: Record<string, unknown>; runWhen: string | null;
  gateModel: Record<string, unknown>; model: { name: string | null; pinned: boolean };
  threadMode: 'new' | 'standing' | 'existing' | 'private'; existingThreadId: string | null; standingThreadId: string | null;
  machineSize: string; maxRunsPerDay: number | null; driveScope: Record<string, unknown>; state: 'active' | 'paused' | 'deleted'; webhookUrl: string | null; webhookToken?: string; createdAt: string; updatedAt: string;
}
export interface AutomationRun {
  id: string; automationId: string; triggerType: TriggerType; triggerKey: string; status: 'queued' | 'running' | 'completed' | 'skipped' | 'duplicate' | 'failed' | 'cancelled';
  threadId: string | null; payload: Record<string, unknown>; skipReason: string | null; createdAt: string;
}
export type PublicAutomationRun = Omit<AutomationRun, 'payload'>
export type PublicAutomationBatch = Omit<AutomationBatch, 'events'> & { eventCount: number }
export interface AutomationBatch { id: string; automationId: string; state: 'open' | 'flushed' | 'cancelled'; events: Record<string, unknown>[] }
export type Gate = (input: { runWhen: string; prompt: string; payload: Record<string, unknown>; model: Record<string, unknown> }) => Promise<boolean>;
export type ModelResolver = (requested: string | null, pinned: boolean) => Promise<string | null>;
export type StartAutomationRun = (input: { threadId: string; prompt: string; automationId: string; runId: string }) => Promise<void>;

type Row = Record<string, unknown>;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const id = (p: string) => `${p}_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : String(v ?? '');

const GITHUB_EVENTS = new Set(['pr-opened','pr-pushed','pr-merged','comment','review','label','check','branch-push','workflow_run']);
function cronSet(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const m = part.match(/^(\*|\d+|\d+-\d+)(?:\/(\d+))?$/);
    if (!m) throw new ApiFailure('ValidationFailed', 'schedule must be a 5-field cron expression');
    const start = m[1] === '*' ? min : Number(m[1].split('-')[0]);
    const end = m[1] === '*' || !m[1].includes('-') ? (m[1] === '*' ? max : Number(m[1])) : Number(m[1].split('-')[1]);
    const step = Number(m[2] ?? 1);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || end < start || step < 1) throw new ApiFailure('ValidationFailed', 'cron field out of range');
    for (let v = start; v <= end; v += step) out.add(v);
  }
  return out;
}
const formatters = new Map<string, Intl.DateTimeFormat>();
function zoned(date: Date, timezone: string): { minute: number; hour: number; day: number; month: number; dow: number } {
  try {
    let formatter = formatters.get(timezone);
    if (!formatter) formatters.set(timezone, (formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, minute: 'numeric', hour: 'numeric', day: 'numeric', month: 'numeric', weekday: 'short', hour12: false })));
    const parts = formatter.formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday') as 'Sun'] ?? 0;
    return { minute: Number(get('minute')), hour: Number(get('hour')) % 24, day: Number(get('day')), month: Number(get('month')), dow };
  } catch { throw new ApiFailure('ValidationFailed', `unknown IANA timezone ${timezone}`); }
}
export function cronMatches(expr: string, timezone: string, date: Date): boolean {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) throw new ApiFailure('ValidationFailed', 'schedule must be a 5-field cron expression');
  const z = zoned(date, timezone);
  const dom = cronSet(f[2], 1, 31).has(z.day); const dow = cronSet(f[4], 0, 6).has(z.dow);
  const domWild = f[2] === '*'; const dowWild = f[4] === '*';
  const dayMatch = domWild && dowWild ? true : domWild || dowWild ? dom && dow : dom || dow;
  return cronSet(f[0], 0, 59).has(z.minute) && cronSet(f[1], 0, 23).has(z.hour) && cronSet(f[3], 1, 12).has(z.month) && dayMatch;
}
function cronJob(expr: string, timezone: string): Cron {
  try { return new Cron(expr, { timezone, paused: true }); }
  catch { throw new ApiFailure('ValidationFailed', 'schedule must be a valid 5-field cron expression with an IANA timezone'); }
}
function validateCron(expr: string, timezone: string): void {
  cronMatches(expr, timezone, new Date());
  const job = cronJob(expr, timezone);
  const first = job.nextRun(new Date());
  const second = first ? job.nextRun(first) : null;
  if (first && second && second.getTime() - first.getTime() < 5 * 60_000) throw new ApiFailure('ValidationFailed', 'schedule frequency floor is 5 minutes');
}
function valueMatch(rule: unknown, actual: unknown): boolean {
  if (Array.isArray(rule)) return rule.some((x) => valueMatch(x, actual));
  if (Array.isArray(actual)) return actual.some((x) => valueMatch(rule, x));
  if (rule && typeof rule === 'object') {
    const r = rule as Record<string, unknown>; const text = String(actual ?? '');
    if (typeof r.equals === 'string' && r.equals !== text) return false;
    if (typeof r.contains === 'string' && !text.includes(r.contains)) return false;
    if (typeof r.regex === 'string') { try { if (!safeRegex(r.regex, text)) return false; } catch { return false; } }
    return Boolean(r.equals ?? r.contains ?? r.regex);
  }
  return String(rule ?? '') === String(actual ?? '');
}
function safeRegex(pattern: string, text: string): boolean {
  // Project-controlled regexes run on the shared event loop. Bound the input and reject constructs
  // that commonly create exponential backtracking; this keeps the feature useful without a native dependency.
  if (pattern.length > 200 || text.length > 4096) return false;
  if (/\\[1-9]|\(\?[=!<]|\([^)]*[+*][^)]*\)[+*]/.test(pattern)) return false;
  return new RegExp(pattern).test(text);
}
export function conditionsMatch(conditions: Record<string, unknown>, payload: Record<string, unknown>): boolean {
  for (const [key, rule] of Object.entries(conditions)) if (!valueMatch(rule, payload[key])) return false;
  return true;
}
function triggerList(raw: unknown): AutomationTrigger[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) throw new ApiFailure('ValidationFailed', 'automation needs 1-20 triggers');
  return raw.map((x) => {
    const t = x as AutomationTrigger;
    if (!['schedule','github','webhook','manual'].includes(String(t.type))) throw new ApiFailure('ValidationFailed', 'unknown trigger type');
    if (t.type === 'schedule') validateCron(String(t.cron ?? ''), String(t.timezone ?? 'UTC'));
    if (t.type === 'github' && !GITHUB_EVENTS.has(String(t.event))) throw new ApiFailure('ValidationFailed', `github event must be one of ${[...GITHUB_EVENTS].join(', ')}`);
    return { type: t.type, cron: t.cron, timezone: t.timezone || 'UTC', event: t.event, batch: t.batch === true, hmac: t.hmac === true };
  });
}
const toAutomation = (r: Row, token?: string): Automation => ({
  id: String(r.id), projectId: String(r.project_id), ownerId: String(r.owner_id), name: String(r.name), prompt: String(r.prompt),
  triggers: r.triggers as AutomationTrigger[], conditions: (r.conditions ?? {}) as Record<string, unknown>, runWhen: r.run_when as string | null,
  gateModel: r.gate_model as Record<string, unknown>, model: r.model as Automation['model'], threadMode: r.thread_mode as Automation['threadMode'],
  existingThreadId: r.existing_thread_id as string | null, standingThreadId: r.standing_thread_id as string | null,
  machineSize: String(r.machine_size ?? 'small'), maxRunsPerDay: r.max_runs_per_day == null ? null : Number(r.max_runs_per_day), driveScope: (r.drive_scope ?? {}) as Record<string, unknown>, state: r.state as Automation['state'], webhookUrl: r.webhook_hash ? `/api/v1/automation-webhooks/${token ?? '<token>'}` : null,
  ...(token ? { webhookToken: token } : {}), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at)
});
const toRun = (r: Row): AutomationRun => ({ id: String(r.id), automationId: String(r.automation_id), triggerType: r.trigger_type as TriggerType, triggerKey: String(r.trigger_key), status: r.status as AutomationRun['status'], threadId: r.thread_id as string | null, payload: (r.payload ?? {}) as Record<string, unknown>, skipReason: r.skip_reason as string | null, createdAt: iso(r.created_at) });

export class AutomationStore {
  private readonly pool: pg.Pool;
  constructor(private readonly databaseUrl: string, private readonly deps: { gate?: Gate; resolveModel?: ModelResolver; startRun?: StartAutomationRun } = {}) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> { return (await this.pool.query(sql, params)).rows as Row[]; }
  private async ownedProject(userId: string, projectId: string): Promise<void> {
    const [p] = await this.q('SELECT owner_id,visibility FROM projects WHERE id=$1', [projectId]);
    if (!p || (p.owner_id !== userId && p.visibility !== 'shared')) throw new ApiFailure('NotFound', 'project not found');
    if (p.owner_id !== userId) throw new ApiFailure('Forbidden', 'only the project owner manages automations');
  }
  async create(userId: string, projectId: string, input: Record<string, unknown>): Promise<Automation> {
    await this.ownedProject(userId, projectId);
    const triggers = triggerList(input.triggers);
    const mode = String(input.threadMode ?? 'new');
    if (!['new','standing','existing','private'].includes(mode)) throw new ApiFailure('ValidationFailed', 'threadMode must be new, standing, existing or private');
    const maxRunsPerDay = input.maxRunsPerDay == null ? null : Number(input.maxRunsPerDay);
    if (maxRunsPerDay != null && (!Number.isInteger(maxRunsPerDay) || maxRunsPerDay < 1)) throw new ApiFailure('ValidationFailed', 'maxRunsPerDay must be a positive integer');
    const driveScope = (input.driveScope ?? {}) as Record<string, unknown>;
    if (!driveScope || typeof driveScope !== 'object' || Array.isArray(driveScope)) throw new ApiFailure('ValidationFailed', 'driveScope must be an object');
    if (!String(input.prompt ?? '').trim() || !String(input.name ?? '').trim()) throw new ApiFailure('ValidationFailed', 'name and prompt are required');
    if (mode === 'existing') {
      const [t] = await this.q('SELECT id,engine FROM threads WHERE id=$1 AND project_id=$2 AND owner_id=$3', [String(input.existingThreadId ?? ''), projectId, userId]);
      if (!t) throw new ApiFailure('ValidationFailed', 'existingThreadId must be a thread in this project owned by you');
    }
    const modelInput = input.model as { name?: unknown; pinned?: unknown } | undefined;
    const model = { name: modelInput?.name == null ? null : String(modelInput.name), pinned: modelInput?.pinned === true };
    const resolved = await (this.deps.resolveModel ?? (async (x) => x ?? 'free-default'))(model.name, model.pinned);
    if (!resolved) throw new ApiFailure('Conflict', 'pinned model is unavailable; no substitution was made');
    model.name = resolved;
    let adapter = 'fake'; let connectionId: string | null = null;
    if (model.pinned) {
      const catalog = modelsCatalogStore(this.databaseUrl);
      if (mode === 'existing') {
        const [t] = await this.q('SELECT engine FROM threads WHERE id=$1', [String(input.existingThreadId)]);
        const engine = (t?.engine ?? {}) as Record<string, unknown>;
        if ((engine.model ?? null) !== model.name || typeof engine.adapter !== 'string') throw new ApiFailure('ValidationFailed', 'existing thread engine does not match the pinned automation model');
        adapter = engine.adapter;
        connectionId = (await catalog.resolve(userId, { adapter, model: model.name, connectionId: engine.connectionId ?? null })).connectionId;
      } else {
        const offers = (await catalog.candidates(userId)).filter((c) => c.models.includes(String(model.name)));
        if (!offers.length) throw new ApiFailure('Conflict', 'pinned model is unavailable; no substitution was made');
        adapter = offers[0].adapter;
        connectionId = (await catalog.resolve(userId, { adapter, model: model.name })).connectionId;
      }
    }
    (model as Record<string, unknown>).adapter = adapter;
    if (connectionId) (model as Record<string, unknown>).connectionId = connectionId;
    const token = triggers.some((t) => t.type === 'webhook') ? randomUUID() + randomUUID() : null;
    const aid = id('aut');
    const [r] = await this.q(`INSERT INTO automations (id,project_id,owner_id,name,prompt,triggers,conditions,run_when,gate_model,model,thread_mode,existing_thread_id,webhook_hash,machine_size,max_runs_per_day,drive_scope)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, [aid, projectId, userId, String(input.name), String(input.prompt), JSON.stringify(triggers), JSON.stringify(input.conditions ?? {}), input.runWhen == null ? null : String(input.runWhen), JSON.stringify(input.gateModel ?? { adapter: 'fake', model: 'free-fast' }), JSON.stringify(model), mode, mode === 'existing' ? String(input.existingThreadId) : null, token ? sha256(token) : null, String(input.machineSize ?? 'small'), maxRunsPerDay, JSON.stringify(driveScope)]);
    return toAutomation(r, token ?? undefined);
  }
  async list(userId: string, projectId: string, filter: { state?: unknown; createdBefore?: unknown; createdAfter?: unknown } = {}): Promise<Automation[]> {
    await this.ownedProject(userId, projectId);
    const vals: unknown[] = [projectId]; const where = ['project_id=$1'];
    if (filter.state !== undefined) { if (!['active','paused','deleted'].includes(String(filter.state))) throw new ApiFailure('ValidationFailed', 'invalid automation state filter'); vals.push(String(filter.state)); where.push(`state=$${vals.length}`); }
    else where.push(`state<>'deleted'`);
    for (const [key, op] of [['createdBefore','<'],['createdAfter','>=']] as const) if (filter[key] !== undefined) { const d = new Date(String(filter[key])); if (Number.isNaN(d.getTime())) throw new ApiFailure('ValidationFailed', 'invalid creation date filter'); vals.push(d); where.push(`created_at${op}$${vals.length}`); }
    return (await this.q(`SELECT * FROM automations WHERE ${where.join(' AND ')} ORDER BY created_at`, vals)).map((r) => toAutomation(r));
  }
  async getOwned(userId: string, automationId: string): Promise<Automation> {
    const [r] = await this.q('SELECT * FROM automations WHERE id=$1 AND owner_id=$2 AND state<>$3', [automationId, userId, 'deleted']);
    if (!r) throw new ApiFailure('NotFound', 'automation not found');
    return toAutomation(r);
  }
  private async ensureThread(a: Automation): Promise<string> {
    if (a.threadMode === 'existing' && a.existingThreadId) return a.existingThreadId;
    if (a.threadMode === 'standing' && a.standingThreadId) {
      const [t] = await this.q('SELECT id FROM threads WHERE id=$1 AND status<>$2', [a.standingThreadId, 'archived']);
      if (t) return a.standingThreadId;
    }
    const tid = id('thr');
    const [project] = await this.q('SELECT visibility FROM projects WHERE id=$1', [a.projectId]);
    const visibility = a.threadMode === 'private' ? 'private' : String(project?.visibility ?? 'private');
    await this.q(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent,visibility) VALUES ($1,'',$2,'thread',$3,$4,'idle',$5,$6,$7,$8)`,
      [tid, a.projectId, a.ownerId, `Automation: ${a.name}`, JSON.stringify({ adapter: (a.model as Record<string, unknown>).adapter ?? 'fake', model: a.model.name, effort: null, connectionId: (a.model as Record<string, unknown>).connectionId ?? null }), JSON.stringify({ maxUsd: null, maxTokens: null, maxWallSec: null, scope: 'thread', onHit: 'pause-and-ask', warnAt: 0.8 }), JSON.stringify({ usd: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0 }), visibility]);
    if (a.threadMode === 'standing') await this.q('UPDATE automations SET standing_thread_id=$1,updated_at=now() WHERE id=$2', [tid, a.id]);
    return tid;
  }
  private async insertRun(a: Automation, type: TriggerType, key: string, payload: Record<string, unknown>, idem: string | null, force = false): Promise<AutomationRun> {
    if (idem) {
      const [old] = await this.q('SELECT * FROM automation_runs WHERE automation_id=$1 AND idempotency_key=$2', [a.id, idem]);
      if (old) return { ...toRun(old), status: 'duplicate' };
    }
    if (a.state !== 'active') return this.recordSkipped(a, type, key, payload, idem, 'automation is paused');
    const trig = a.triggers.find((t) => t.type === type && (type !== 'github' || t.event === payload.event));
    if (!trig && !force) return this.recordSkipped(a, type, key, payload, idem, 'no matching trigger');
    if (!force && !conditionsMatch(a.conditions, payload)) return this.recordSkipped(a, type, key, payload, idem, 'conditions did not match');
    if (!force && a.runWhen) {
      const ok = await (this.deps.gate ?? (async () => false))({ runWhen: a.runWhen, prompt: a.prompt, payload, model: a.gateModel });
      if (!ok) return this.recordSkipped(a, type, key, payload, idem, 'run_when gate rejected');
    }
    if (a.maxRunsPerDay != null) {
      const [count] = await this.q(`SELECT count(*)::int n FROM automation_runs WHERE automation_id=$1 AND created_at >= date_trunc('day', now()) AND status NOT IN ('skipped','duplicate','cancelled')`, [a.id]);
      if (Number(count?.n ?? 0) >= a.maxRunsPerDay) return this.recordSkipped(a, type, key, payload, idem, 'max_runs_per_day reached');
    }
    const threadId = await this.ensureThread(a);
    const rid = id('arun');
    try {
      const [r] = await this.q('INSERT INTO automation_runs (id,automation_id,trigger_type,trigger_key,idempotency_key,status,thread_id,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [rid, a.id, type, key, idem, 'queued', threadId, JSON.stringify(payload)]);
      if (this.deps.startRun) {
        try {
          await this.deps.startRun({ threadId, prompt: a.prompt, automationId: a.id, runId: rid });
          await this.q('UPDATE automation_runs SET dispatched_at=now(),dispatch_attempts=dispatch_attempts+1 WHERE id=$1', [rid]);
        } catch (err) {
          await this.q('UPDATE automation_runs SET dispatch_attempts=dispatch_attempts+1 WHERE id=$1', [rid]).catch(() => undefined);
          throw err;
        }
      }
      return toRun(r);
    } catch (e) {
      if (idem && String((e as { code?: string }).code) === '23505') {
        const [old] = await this.q('SELECT * FROM automation_runs WHERE automation_id=$1 AND idempotency_key=$2', [a.id, idem]);
        if (old) return { ...toRun(old), status: 'duplicate' };
      }
      throw e;
    }
  }
  private async recordSkipped(a: Automation, type: TriggerType, key: string, payload: Record<string, unknown>, idem: string | null, reason: string): Promise<AutomationRun> {
    const [r] = await this.q('INSERT INTO automation_runs (id,automation_id,trigger_type,trigger_key,idempotency_key,status,payload,skip_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [id('arun'), a.id, type, key, idem, 'skipped', JSON.stringify(payload), reason]);
    return toRun(r);
  }
  async update(userId: string, automationId: string, input: Record<string, unknown>): Promise<Automation> {
    const existing = await this.getOwned(userId, automationId);
    const vals: unknown[] = [automationId, userId]; const sets: string[] = [];
    const set = (column: string, value: unknown) => { vals.push(value); sets.push(`${column}=$${vals.length}`); };
    if (input.name !== undefined) { if (!String(input.name).trim()) throw new ApiFailure('ValidationFailed', 'name is required'); set('name', String(input.name)); }
    if (input.prompt !== undefined) { if (!String(input.prompt).trim()) throw new ApiFailure('ValidationFailed', 'prompt is required'); set('prompt', String(input.prompt)); }
    if (input.triggers !== undefined) set('triggers', JSON.stringify(triggerList(input.triggers)));
    if (input.conditions !== undefined) { if (!input.conditions || typeof input.conditions !== 'object' || Array.isArray(input.conditions)) throw new ApiFailure('ValidationFailed', 'conditions must be an object'); set('conditions', JSON.stringify(input.conditions)); }
    if (input.runWhen !== undefined) set('run_when', input.runWhen == null ? null : String(input.runWhen));
    if (input.machineSize !== undefined) set('machine_size', String(input.machineSize));
    if (input.maxRunsPerDay !== undefined) { const n = input.maxRunsPerDay == null ? null : Number(input.maxRunsPerDay); if (n != null && (!Number.isInteger(n) || n < 1)) throw new ApiFailure('ValidationFailed', 'maxRunsPerDay must be a positive integer'); set('max_runs_per_day', n); }
    if (input.driveScope !== undefined) { if (!input.driveScope || typeof input.driveScope !== 'object' || Array.isArray(input.driveScope)) throw new ApiFailure('ValidationFailed', 'driveScope must be an object'); set('drive_scope', JSON.stringify(input.driveScope)); }
    if (!sets.length) return existing;
    const [r] = await this.q(`UPDATE automations SET ${sets.join(',')},updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`, vals);
    return toAutomation(r);
  }
  async setState(userId: string, automationId: string, state: unknown): Promise<Automation> {
    if (!['active','paused','deleted'].includes(String(state))) throw new ApiFailure('ValidationFailed', 'state must be active, paused or deleted');
    if (!(await this.q('SELECT id FROM automations WHERE id=$1 AND owner_id=$2', [automationId, userId])).length) throw new ApiFailure('NotFound', 'automation not found');
    const [r] = await this.q('UPDATE automations SET state=$3,deleted_at=CASE WHEN $3=$4 THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *', [automationId, userId, String(state), 'deleted']);
    if (!r) throw new ApiFailure('NotFound', 'automation not found');
    return toAutomation(r);
  }
  async rotateWebhook(userId: string, automationId: string): Promise<Automation> {
    const a = await this.getOwned(userId, automationId);
    if (!a.triggers.some((t) => t.type === 'webhook')) throw new ApiFailure('ValidationFailed', 'automation has no webhook trigger');
    const token = randomUUID() + randomUUID();
    const [r] = await this.q('UPDATE automations SET webhook_hash=$3,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *', [automationId, userId, sha256(token)]);
    return toAutomation(r, token);
  }
  async runs(userId: string, automationId: string): Promise<PublicAutomationRun[]> {
    const a = await this.getOwned(userId, automationId);
    return (await this.q('SELECT * FROM automation_runs WHERE automation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100', [a.id])).map((r) => { const x = toRun(r) as Partial<AutomationRun>; delete x.payload; return x as PublicAutomationRun; });
  }
  async cancelRun(userId: string, automationId: string, runId: string): Promise<PublicAutomationRun> {
    const a = await this.getOwned(userId, automationId);
    const [r] = await this.q(`UPDATE automation_runs SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=$1 AND automation_id=$2 AND status IN ('queued','running') RETURNING *`, [runId, a.id]);
    if (!r) throw new ApiFailure('NotFound', 'queued or running automation run not found');
    const x = toRun(r) as Partial<AutomationRun>; delete x.payload; return x as PublicAutomationRun;
  }
  async trigger(userId: string, automationId: string, payload: Record<string, unknown> = {}): Promise<AutomationRun> {
    const a = await this.getOwned(userId, automationId);
    return this.insertRun({ ...a, triggers: a.triggers.filter((t) => t.type === 'manual').length ? a.triggers : [...a.triggers, { type: 'manual' }] }, 'manual', 'manual', payload, typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : null, true);
  }
  async triggerGithub(userId: string, automationId: string, event: string, payload: Record<string, unknown>): Promise<AutomationRun> {
    const a = await this.getOwned(userId, automationId);
    return this.insertRun(a, 'github', event, { ...payload, event }, typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : null);
  }
  async githubEvent(event: string, body: Record<string, unknown>): Promise<AutomationRun[]> {
    const action = String(body.action ?? '');
    const mapped = event === 'pull_request' ? (action === 'opened' ? 'pr-opened' : action === 'synchronize' ? 'pr-pushed' : action === 'closed' && (body.pull_request as Row | undefined)?.merged === true ? 'pr-merged' : action === 'labeled' ? 'label' : null)
      : event === 'issue_comment' ? 'comment' : event === 'pull_request_review' ? 'review' : event === 'push' ? 'branch-push' : event === 'workflow_run' ? 'workflow_run' : ['check_run', 'check_suite', 'status'].includes(event) ? 'check' : null;
    if (!mapped) return [];
    const pr = (body.pull_request ?? {}) as Row; const repo = ((body.repository ?? {}) as Row).full_name;
    const labels = Array.isArray(pr.labels) ? pr.labels.map((x) => String((x as Row).name ?? x)) : [];
    const payload: Record<string, unknown> = { event: mapped, repo, branch: pr.base && typeof pr.base === 'object' ? (pr.base as Row).ref : body.ref ? String(body.ref).replace(/^refs\/heads\//, '') : undefined, author: String(((body.sender ?? {}) as Row).login ?? ''), labels, text: String(pr.title ?? (body.comment as Row | undefined)?.body ?? (body.workflow_run as Row | undefined)?.name ?? ''), raw: body };
    const rows = await this.q("SELECT * FROM automations WHERE state='active'");
    const out: AutomationRun[] = [];
    for (const row of rows) {
      const a = toAutomation(row);
      if (a.triggers.some((t) => t.type === 'github' && t.event === mapped)) out.push(await this.insertRun(a, 'github', mapped, payload, typeof body.delivery_id === 'string' ? String(body.delivery_id) : null));
    }
    return out;
  }
  async webhook(token: string, payload: Record<string, unknown>, idem: string | null, signature: string | null = null, rawBody = ''): Promise<{ result: 'accepted' | 'duplicate' | 'no-match' | 'batched'; run?: PublicAutomationRun; batch?: PublicAutomationBatch }> {
    const [row] = await this.q('SELECT * FROM automations WHERE webhook_hash=$1 AND state=$2', [sha256(token), 'active']);
    if (!row) return { result: 'no-match' };
    const a = toAutomation(row); const trig = a.triggers.find((t) => t.type === 'webhook');
    if (!trig || !conditionsMatch(a.conditions, payload)) return { result: 'no-match' };
    if (trig.hmac) {
      const expected = createHmac('sha256', token).update(rawBody).digest('hex');
      if (!signature || signature !== expected) throw new ApiFailure('Forbidden', 'invalid webhook HMAC signature');
    }
    if (trig.batch) {
      const batch = await this.appendBatch(a, payload);
      return { result: 'batched', batch: { id: batch.id, automationId: batch.automationId, state: batch.state, eventCount: batch.events.length } };
    }
    const run = await this.insertRun(a, 'webhook', 'webhook', payload, idem);
    const publicRun = (r: AutomationRun): PublicAutomationRun => ({ id: r.id, automationId: r.automationId, triggerType: r.triggerType, triggerKey: r.triggerKey, status: r.status, threadId: r.threadId, skipReason: r.skipReason, createdAt: r.createdAt });
    if (run.status === 'duplicate') return { result: 'duplicate', run: publicRun(run) };
    if (run.status === 'skipped' && run.skipReason === 'no matching trigger') return { result: 'no-match', run: publicRun(run) };
    return { result: run.status === 'skipped' && run.skipReason === 'conditions did not match' ? 'no-match' : 'accepted', run: publicRun(run) };
  }
  private async appendBatch(a: Automation, payload: Record<string, unknown>): Promise<AutomationBatch> {
    let [b] = await this.q("SELECT * FROM automation_batches WHERE automation_id=$1 AND state='open' ORDER BY created_at DESC LIMIT 1", [a.id]);
    if (!b) [b] = (await this.q('INSERT INTO automation_batches (id,automation_id) VALUES ($1,$2) RETURNING *', [id('abat'), a.id]));
    [b] = await this.q('UPDATE automation_batches SET events=events||$2::jsonb,updated_at=now() WHERE id=$1 RETURNING *', [b.id, JSON.stringify([payload])]);
    return { id: String(b.id), automationId: a.id, state: b.state as AutomationBatch['state'], events: b.events as Record<string, unknown>[] };
  }
  async batches(userId: string, automationId: string): Promise<AutomationBatch[]> {
    const a = await this.getOwned(userId, automationId);
    return (await this.q('SELECT * FROM automation_batches WHERE automation_id=$1 ORDER BY created_at', [a.id])).map((b) => ({ id: String(b.id), automationId: a.id, state: b.state as AutomationBatch['state'], events: b.events as Record<string, unknown>[] }));
  }
  async flushBatch(userId: string, automationId: string, batchId: string): Promise<AutomationRun> {
    const a = await this.getOwned(userId, automationId);
    const [b] = await this.q("UPDATE automation_batches SET state='flushed',updated_at=now() WHERE id=$1 AND automation_id=$2 AND state='open' RETURNING *", [batchId, a.id]);
    if (!b) throw new ApiFailure('NotFound', 'open batch not found');
    return this.insertRun(a, 'webhook', 'webhook-batch', { events: b.events }, `batch:${batchId}`, true);
  }
  async cancelBatch(userId: string, automationId: string, batchId: string): Promise<AutomationBatch> {
    const a = await this.getOwned(userId, automationId);
    const [b] = await this.q("UPDATE automation_batches SET state='cancelled',updated_at=now() WHERE id=$1 AND automation_id=$2 AND state='open' RETURNING *", [batchId, a.id]);
    if (!b) throw new ApiFailure('NotFound', 'open batch not found');
    return { id: String(b.id), automationId: a.id, state: 'cancelled', events: b.events as Record<string, unknown>[] };
  }
  async dueSchedules(now: Date): Promise<AutomationRun[]> {
    const rows = await this.q("SELECT * FROM automations WHERE state='active'");
    const out: AutomationRun[] = [];
    for (const row of rows) {
      const a = toAutomation(row);
      for (const t of a.triggers.filter((x) => x.type === 'schedule')) {
        const key = `${t.cron}:${t.timezone}`;
        const [last] = await this.q("SELECT max(created_at) AS at FROM automation_runs WHERE automation_id=$1 AND trigger_type='schedule' AND trigger_key=$2", [a.id, key]);
        const base = Math.max(new Date(a.createdAt).getTime(), last?.at ? new Date(last.at as string).getTime() : 0);
        let latest: Date | null = null;
        const end = Math.floor(now.getTime() / 60_000) * 60_000;
        // Croner calculates the next occurrence directly, so even a months-old missed schedule is
        // found without a minute-by-minute scan. Iterate to the newest due occurrence; older misses coalesce.
        const job = cronJob(String(t.cron), String(t.timezone ?? 'UTC'));
        let next = job.nextRun(new Date(base));
        for (let iterations = 0; next && next.getTime() <= end && iterations < 200_000; iterations++) {
          latest = next;
          next = job.nextRun(new Date(next.getTime() + 60_000));
        }
        if (latest) out.push(await this.insertRun(a, 'schedule', key, { at: latest.toISOString(), cron: t.cron, timezone: t.timezone, coalesced: latest.getTime() !== end }, `cron:${a.id}:${key}:${Math.floor(latest.getTime() / 60000)}`));
      }
    }
    return out;
  }
  /** Re-dispatch queued runs whose runner handoff was interrupted. Handoff is at-least-once; five failures fail the run closed. */
  async recoverDispatches(limit = 25): Promise<number> {
    if (!this.deps.startRun) return 0;
    const rows = await this.q(`SELECT r.*,a.prompt,a.owner_id,a.project_id,a.name,a.triggers,a.conditions,a.run_when,a.gate_model,a.model,a.thread_mode,a.existing_thread_id,a.standing_thread_id,a.webhook_hash,a.machine_size,a.state,a.created_at automation_created_at,a.updated_at automation_updated_at
      FROM automation_runs r JOIN automations a ON a.id=r.automation_id
      WHERE r.status='queued' AND r.dispatched_at IS NULL AND r.dispatch_attempts<5 AND r.created_at < now() - interval '10 seconds' ORDER BY r.created_at LIMIT $1`, [limit]);
    let recovered = 0;
    for (const row of rows) {
      const a = toAutomation({ ...row, id: row.automation_id, created_at: row.automation_created_at, updated_at: row.automation_updated_at });
      try {
        await this.deps.startRun({ threadId: String(row.thread_id), prompt: a.prompt, automationId: a.id, runId: String(row.id) });
        await this.q('UPDATE automation_runs SET dispatched_at=now(),dispatch_attempts=dispatch_attempts+1,updated_at=now() WHERE id=$1', [row.id]);
        recovered++;
      } catch {
        await this.q(`UPDATE automation_runs SET dispatch_attempts=dispatch_attempts+1,status=CASE WHEN dispatch_attempts+1>=5 THEN 'failed' ELSE status END,updated_at=now() WHERE id=$1`, [row.id]);
      }
    }
    return recovered;
  }
  async close(): Promise<void> { await this.pool.end(); }
}
const stores = new Map<string, AutomationStore>();
export function automationStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost/flotilla', deps: { gate?: Gate; resolveModel?: ModelResolver; startRun?: StartAutomationRun } = {}): AutomationStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new AutomationStore(databaseUrl, deps)));
  return store;
}
