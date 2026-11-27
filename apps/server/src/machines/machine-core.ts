import pg from 'pg';
import type { CostTotals, ProcessTransport } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';
import { registerEnvironmentMachine, type EnvironmentExecutor, type EnvironmentMachine } from '../environments/executor.js';
import { environmentStore } from '../environments/store.js';

/** Pool machine sizes (Capy Small→Big Guy). The size sets the container's RAM/CPU and its awake $/h. */
export const MACHINE_SIZES = {
  small: { memMb: 2048, cpus: 1, microUsdPerHour: 20_000 },
  medium: { memMb: 4096, cpus: 2, microUsdPerHour: 40_000 },
  large: { memMb: 8192, cpus: 4, microUsdPerHour: 80_000 },
  'big-guy': { memMb: 16384, cpus: 8, microUsdPerHour: 160_000 }
} as const;
export type MachineSize = keyof typeof MACHINE_SIZES;
const SIZES = Object.keys(MACHINE_SIZES) as MachineSize[];
/** What a hardened pool container cannot do (see dockerDriver: CapDrop ALL, no-new-privileges, no devices). */
export const KERNEL_LIMITS = {
  kvm: false, kernelModules: false, privileged: false, nestedContainers: false,
  netfilter: ['no iptables/nftables rules (CAP_NET_ADMIN dropped)', 'no raw sockets or ping (CAP_NET_RAW dropped)', 'no ipset, conntrack or tc changes', 'egress only through the gate proxy']
};
export type MachineCap = { ramMb: number; maxSize: MachineSize; windDownMs: number; keepAwakeMs: number; deleteAfterMs: number; warnBeforeMs: number; startWaitSec: number };
export function machineCapFromEnv(env: Record<string, string | undefined>): MachineCap {
  const max = env.FLOTILLA_MACHINE_MAX_SIZE as MachineSize;
  return { ramMb: Number(env.FLOTILLA_MACHINE_RAM_MB) || 16384, maxSize: SIZES.includes(max) ? max : 'large', windDownMs: 120_000, keepAwakeMs: 4 * 3_600_000, deleteAfterMs: 14 * 86_400_000, warnBeforeMs: 86_400_000, startWaitSec: 60 };
}
export function machineCharge(size: MachineSize, sec: number): CostTotals {
  return { usd: Math.round(MACHINE_SIZES[size].microUsdPerHour * sec / 3600) as never, inputTokens: 0 as never, outputTokens: 0 as never, cacheTokens: 0 as never, machineSec: sec };
}
/** `.node-version` wins over `.nvmrc`; aliases like `lts/*` are ignored. */
export function nodeVersionFrom(files: Record<string, string | undefined>): string | null {
  for (const f of ['.node-version', '.nvmrc']) { const m = files[f]?.trim().match(/^v?(\d+(?:\.\d+){0,2})$/); if (m) return m[1]; }
  return null;
}
export type LeaseView = { state: string; busy: boolean; idleSince: number | null; keepAwakeUntil: number | null; sleptAt: number | null; warnedAt: number | null };
export function nextStep(l: LeaseView, cap: MachineCap, now: number, held: boolean): 'none' | 'sleep' | 'warn' | 'delete' {
  if (l.state === 'awake') {
    if (l.busy || held || (l.keepAwakeUntil ?? 0) > now || l.idleSince === null) return 'none';
    return now - Math.max(l.idleSince, l.keepAwakeUntil ?? 0) >= cap.windDownMs ? 'sleep' : 'none';
  }
  if (l.state !== 'sleeping' || l.sleptAt === null) return 'none';
  if (now - l.sleptAt >= cap.deleteAfterMs) return 'delete';
  return now - l.sleptAt >= cap.deleteAfterMs - cap.warnBeforeMs && l.warnedAt === null ? 'warn' : 'none';
}

type Row = Record<string, any>;
export type MachineDriver = { transport(id: string): ProcessTransport; stop(id: string): Promise<void>; remove?(id: string): Promise<void>; deleteWorkspace?(threadId: string): Promise<void>; findContainer?(threadId: string): Promise<string | null>; removeThreadNetwork?(threadId: string): Promise<void> };
type Hooks = { driver?: MachineDriver; emit?(threadId: string, payload: Record<string, unknown>): Promise<void>; beforeDelete?(threadId: string): Promise<void> };
const ms = (d: Date | null) => (d ? d.getTime() : null);
const view = (r: Row): LeaseView => ({ state: r.state, busy: r.holds > 0, idleSince: ms(r.idle_since), keepAwakeUntil: ms(r.keep_awake_until), sleptAt: ms(r.slept_at), warnedAt: ms(r.warned_at) });
const REPO = '/workspace/repo';

async function probe(t: ProcessTransport): Promise<{ head: string | null; files: Record<string, string> }> {
  const h = t.spawn(['sh', '-c', `cd "$1" 2>/dev/null || exit 0; printf '%s\\n' "$(git rev-parse HEAD 2>/dev/null)" "$(cat .node-version 2>/dev/null)" "$(cat .nvmrc 2>/dev/null)"`, 'sh', REPO], { cwd: '/', env: {} });
  const out: string[] = []; for await (const l of h.stdout) out.push(l); await h.exit;
  return { head: out[0] || null, files: { '.node-version': out[1], '.nvmrc': out[2] } };
}

/** Pool machine lifecycle: starting → awake → sleeping (container removed, workspace volume kept) → deleted after 14 days. */
export class MachineCore {
  readonly pool: pg.Pool; readonly cap: MachineCap;
  private readonly now: () => number; private readonly secondMs: number; private hooks: Hooks = {};
  private readonly envs = new Map<string, { ex: EnvironmentExecutor; off(): void; containerId: string }>();
  constructor(readonly databaseUrl: string, opts: { cap?: MachineCap; now?: () => number; secondMs?: number } = {}) {
    this.pool = new pg.Pool({ connectionString: databaseUrl }); this.cap = opts.cap ?? machineCapFromEnv(process.env);
    this.now = opts.now ?? Date.now; this.secondMs = opts.secondMs ?? 1000;
  }
  attach(h: Hooks): void { this.hooks = { ...this.hooks, ...h }; }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> { return (await this.pool.query(sql, params)).rows; }
  private at(t = this.now()): Date { return new Date(t); }

  limits() {
    const max = SIZES.indexOf(this.cap.maxSize);
    return { ramMb: this.cap.ramMb, serviceRamMb: Math.floor(this.cap.ramMb / 2), maxSize: this.cap.maxSize, sizes: SIZES.map((size, i) => ({ size, ...MACHINE_SIZES[size], allowed: i <= max })), kernel: KERNEL_LIMITS };
  }
  async ownedProject(userId: string, projectId: string): Promise<string> {
    if (!(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId])).length) throw new ApiFailure('NotFound', 'project not found');
    return projectId;
  }
  async ownedThread(userId: string, threadId: string): Promise<string | null> {
    const [t] = await this.q('SELECT project_id FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]);
    if (!t) throw new ApiFailure('NotFound', 'thread not found');
    return t.project_id;
  }
  async size(projectId: string | null): Promise<MachineSize> {
    return projectId ? (await this.q('SELECT machine_size FROM projects WHERE id=$1', [projectId]))[0]?.machine_size ?? 'small' : 'small';
  }
  async setSize(projectId: string | null, size: unknown): Promise<{ projectId: string; size: MachineSize }> {
    if (!projectId) throw new ApiFailure('ValidationFailed', 'thread has no project');
    if (!SIZES.includes(size as MachineSize)) throw new ApiFailure('ValidationFailed', `size must be one of ${SIZES.join(', ')}`);
    if (SIZES.indexOf(size as MachineSize) > SIZES.indexOf(this.cap.maxSize)) throw new ApiFailure('PaidFeatureUnavailable', `${size} machines need a bigger plan (this plan allows up to ${this.cap.maxSize})`);
    await this.q('UPDATE projects SET machine_size=$2 WHERE id=$1', [projectId, size]);
    return { projectId, size: size as MachineSize };
  }
  async state(threadId: string) {
    const [r] = await this.q('SELECT * FROM machine_leases WHERE thread_id=$1', [threadId]);
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    return r ? { state: r.state, size: r.size, memMb: r.mem_mb, awakeSince: iso(r.awake_since), keepAwakeUntil: iso(r.keep_awake_until), sleptAt: iso(r.slept_at), deleteAt: r.slept_at ? iso(new Date(r.slept_at.getTime() + this.cap.deleteAfterMs)) : null } : { state: 'none', size: null, memMb: null, awakeSince: null, keepAwakeUntil: null, sleptAt: null, deleteAt: null };
  }

  /** Under the global lock: 'busy' when another caller already starts/holds this thread's machine, else reserve its RAM. */
  private async admit(threadId: string, size: MachineSize, service: boolean, policy: string): Promise<{ ok: boolean; busy?: boolean; prev?: string }> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock(170117)');
      const prev = (await c.query('SELECT state FROM machine_leases WHERE thread_id=$1', [threadId])).rows[0]?.state as string | undefined;
      if (prev === 'starting' || prev === 'awake') { await c.query('COMMIT'); return { ok: false, busy: true }; }
      const { rows: [u] } = await c.query(`SELECT coalesce(sum(mem_mb),0)::int total, coalesce(sum(mem_mb) FILTER (WHERE service),0)::int svc FROM machine_leases WHERE state IN ('starting','awake') AND thread_id<>$1`, [threadId]);
      const mem = MACHINE_SIZES[size].memMb;
      const ok = u.total + mem <= this.cap.ramMb && (!service || u.svc + mem <= Math.floor(this.cap.ramMb / 2));
      if (ok) await c.query(`INSERT INTO machine_leases (thread_id,size,mem_mb,service,state,holds,policy,updated_at) VALUES ($1,$2,$3,$4,'starting',1,$6,$5) ON CONFLICT (thread_id) DO UPDATE SET size=$2,mem_mb=$3,service=$4,state='starting',holds=1,policy=$6,updated_at=$5`, [threadId, size, mem, service, this.at(), policy]);
      await c.query('COMMIT'); return { ok, prev };
    } catch (err) { await c.query('ROLLBACK').catch(() => undefined); throw err; } finally { c.release(); }
  }
  private async restore(threadId: string, state: string | undefined): Promise<void> {
    if (state) await this.q(`UPDATE machine_leases SET state=$2,holds=0,container_id=NULL WHERE thread_id=$1`, [threadId, state]);
    else await this.q('DELETE FROM machine_leases WHERE thread_id=$1', [threadId]);
  }

  /** Holds the thread's machine awake, booting/waking it (RAM-capped, waits up to 1 min) when it is not. Pair with release(). */
  async boot(threadId: string, projectId: string | null, start: (memMb: number, cpus: number) => Promise<{ containerId: string }>, driver: MachineDriver, seed?: (containerId: string, fresh: boolean) => Promise<void>, policy = ''): Promise<{ containerId: string; fresh: boolean; woke: boolean }> {
    const size = await this.size(projectId);
    const [o] = await this.q('SELECT u.role FROM threads t JOIN users u ON u.id=t.owner_id WHERE t.id=$1', [threadId]);
    const service = o?.role === 'service';
    const deadline = Date.now() + this.cap.startWaitSec * this.secondMs;
    let prev: string | undefined;
    for (;;) {
      let [cur] = await this.q('SELECT * FROM machine_leases WHERE thread_id=$1', [threadId]);
      for (let i = 0; cur?.state === 'starting' && i < this.cap.startWaitSec * 4; i++) { await new Promise((r) => setTimeout(r, this.secondMs / 4)); [cur] = await this.q('SELECT * FROM machine_leases WHERE thread_id=$1', [threadId]); }
      if (cur?.state === 'awake' && cur.container_id) {
        if ((cur.policy ?? '') !== policy && cur.holds === 0 && await this.sleep(cur, this.now())) continue;
        const [held] = await this.q(`UPDATE machine_leases SET holds=holds+1,idle_since=NULL WHERE thread_id=$1 AND state='awake' AND container_id=$2 RETURNING container_id`, [threadId, cur.container_id]);
        if (held) return { containerId: held.container_id, fresh: false, woke: false };
        continue;
      }
      const got = await this.admit(threadId, size, service, policy);
      if (got.ok) { prev = got.prev; break; }
      if (Date.now() >= deadline) {
        const why = got.busy ? "Cloud machine couldn't start: another start of this machine did not finish" : `Cloud machine couldn't start: the concurrent RAM limit (${service ? `${Math.floor(this.cap.ramMb / 2)} MB for service-user threads` : `${this.cap.ramMb} MB`}) is in use`;
        await this.hooks.emit?.(threadId, { state: 'failed', error: why }).catch(() => undefined);
        throw new ApiFailure('Conflict', why);
      }
      if (!got.busy) await new Promise((r) => setTimeout(r, Math.min(5 * this.secondMs, Math.max(1, deadline - Date.now()))));
    }
    let fresh = !prev || prev === 'deleted'; let containerId: string;
    const { memMb, cpus } = MACHINE_SIZES[size];
    try { ({ containerId } = await start(memMb, cpus)); } catch (err) {
      // Never destroy the workspace volume as a side effect of a failed wake. Until the
      // pre-delete WIP capture exists, a corrupt or unstartable workspace must fail closed.
      await this.restore(threadId, prev);
      throw err;
    }
    await this.q(`UPDATE machine_leases SET state='awake',container_id=$2,awake_since=$3,idle_since=NULL,slept_at=NULL,warned_at=NULL,updated_at=$3 WHERE thread_id=$1`, [threadId, containerId, this.at()]);
    await seed?.(containerId, fresh);
    if (projectId) await this.startEnvironment(threadId, containerId, driver, fresh).catch(() => undefined);
    await this.hooks.emit?.(threadId, { state: 'awake', fresh }).catch(() => undefined);
    return { containerId, fresh, woke: prev === 'sleeping' || prev === 'deleted' };
  }
  /** Boot/wake: register the machine for environment tools, run setup when due, then (re)run every startup entry. */
  private async startEnvironment(threadId: string, containerId: string, driver: MachineDriver, fresh: boolean): Promise<void> {
    const transport = driver.transport(containerId);
    const { head, files } = await probe(transport).catch(() => ({ head: null, files: {} }));
    const node = nodeVersionFrom(files);
    const machine: EnvironmentMachine = { transport, caps: { repoDir: REPO, sudo: false }, env: node ? { FLOTILLA_NODE_VERSION: node } : {} };
    this.envs.get(threadId)?.off();
    const store = environmentStore(this.databaseUrl); const ex = store.executor(threadId, machine);
    this.envs.set(threadId, { ex, off: registerEnvironmentMachine(threadId, machine), containerId });
    await store.prepare(threadId, machine, { freshClone: fresh, head }, {}, ex);
  }
  async release(threadId: string): Promise<void> {
    await this.q(`UPDATE machine_leases SET holds=greatest(holds-1,0),idle_since=CASE WHEN holds<=1 THEN $2::timestamptz ELSE idle_since END WHERE thread_id=$1 AND state='awake'`, [threadId, this.at()]);
  }
  /** After a server restart no run holds a machine; recover any container that crossed Docker creation before the crash so its RAM stays reserved. */
  async reset(): Promise<void> {
    await this.q(`UPDATE machine_leases SET holds=0,idle_since=$1 WHERE state='awake' AND holds>0`, [this.at()]);
    for (const r of await this.q(`SELECT thread_id FROM machine_leases WHERE state='starting'`)) {
      const containerId = await this.hooks.driver?.findContainer?.(r.thread_id).catch(() => null) ?? null;
      if (containerId) await this.q(`UPDATE machine_leases SET state='awake',container_id=$2,holds=0,idle_since=$3,awake_since=coalesce(awake_since,$3),updated_at=$3 WHERE thread_id=$1 AND state='starting'`, [r.thread_id, containerId, this.at()]);
      else await this.q(`UPDATE machine_leases SET state='sleeping',holds=0,container_id=NULL,slept_at=$2,updated_at=$2 WHERE thread_id=$1 AND state='starting'`, [r.thread_id, this.at()]);
    }
  }
  async keepAwake(threadId: string, on: boolean) {
    await this.q('UPDATE machine_leases SET keep_awake_until=$2 WHERE thread_id=$1 AND state=\'awake\'', [threadId, on ? this.at(this.now() + this.cap.keepAwakeMs) : null]);
    return this.state(threadId);
  }
  /** User-requested resize/move helper: fail closed while a run holds the machine, otherwise sleep it without deleting the workspace volume. */
  async sleepNow(threadId: string): Promise<void> {
    const [r] = await this.q('SELECT * FROM machine_leases WHERE thread_id=$1', [threadId]);
    if (!r || r.state === 'sleeping' || r.state === 'deleted') return;
    if (r.state === 'starting' || r.holds > 0) throw new ApiFailure('Conflict', 'machine is busy; stop the run before moving it');
    await this.sleep(r, this.now());
  }
  /** Captures machine state before a thread row is deleted; the returned cleanup runs only after the delete commits. */
  async prepareDestroy(threadId: string): Promise<() => Promise<void>> {
    const [r] = await this.q('SELECT * FROM machine_leases WHERE thread_id=$1', [threadId]);
    const strayContainer = r ? null : await this.hooks.driver?.findContainer?.(threadId).catch(() => null) ?? null;
    return async () => {
      let ok = true;
      if (r) ok = await this.dispose(r);
      else if (strayContainer) await (this.hooks.driver?.remove?.(strayContainer) ?? this.hooks.driver?.stop(strayContainer))?.catch(() => { ok = false; });
      const env = this.envs.get(threadId); if (env) { this.envs.delete(threadId); await env.ex.stop().catch(() => { ok = false; }); env.off(); }
      await this.q('DELETE FROM machine_leases WHERE thread_id=$1', [threadId]);
      await this.hooks.driver?.removeThreadNetwork?.(threadId).catch(() => { ok = false; });
      await this.hooks.driver?.deleteWorkspace?.(threadId).catch(() => { ok = false; });
      if (ok) await this.q('DELETE FROM machine_cleanups WHERE thread_id=$1', [threadId]);
    };
  }
  /** Reconciles deletion cleanup that was committed but interrupted before Docker/workspace disposal finished. */
  async recoverCleanups(): Promise<void> {
    for (const r of await this.q('SELECT * FROM machine_cleanups ORDER BY created_at')) {
      const containerId = r.container_id ?? await this.hooks.driver?.findContainer?.(r.thread_id).catch(() => null) ?? null;
      let ok = true;
      if (containerId) await (this.hooks.driver?.remove?.(containerId) ?? this.hooks.driver?.stop(containerId))?.catch(() => { ok = false; });
      await this.hooks.driver?.removeThreadNetwork?.(r.thread_id).catch(() => { ok = false; });
      await this.hooks.driver?.deleteWorkspace?.(r.thread_id).catch(() => { ok = false; });
      if (ok) await this.q('DELETE FROM machine_cleanups WHERE thread_id=$1', [r.thread_id]);
    }
  }
  /** User-initiated thread deletion: dispose any live container immediately instead of letting the FK cascade orphan it. */
  async destroyThread(threadId: string): Promise<void> { await (await this.prepareDestroy(threadId))(); }

  async tick(): Promise<void> {
    const now = this.now();
    const rows = await this.q(`SELECT l.*, EXISTS (SELECT 1 FROM previews p WHERE p.thread_id=l.thread_id AND p.awake_until > $1) held FROM machine_leases l WHERE l.state IN ('awake','sleeping')`, [this.at(now)]);
    for (const r of rows) {
      const v = view(r); const step = nextStep(v, this.cap, now, r.held);
      if (step === 'sleep') await this.sleep(r, Math.min(now, Math.max(v.idleSince!, v.keepAwakeUntil ?? 0) + this.cap.windDownMs));
      else if (step === 'warn') {
        await this.q('UPDATE machine_leases SET warned_at=$2 WHERE thread_id=$1', [r.thread_id, this.at(now)]);
        await this.hooks.emit?.(r.thread_id, { state: 'sleeping', warning: `machine will be deleted at ${new Date(v.sleptAt! + this.cap.deleteAfterMs).toISOString()}; wake it to keep it` }).catch(() => undefined);
      } else if (step === 'delete') await this.delete(r);
    }
  }
  private async dispose(r: Row): Promise<boolean> {
    let ok = true;
    const env = this.envs.get(r.thread_id);
    if (env && env.containerId === r.container_id) { this.envs.delete(r.thread_id); await env.ex.stop().catch(() => { ok = false; }); env.off(); }
    const d = this.hooks.driver;
    if (d && r.container_id) await (d.remove ? d.remove(r.container_id) : d.stop(r.container_id)).catch(() => { ok = false; });
    return ok;
  }
  /** Claims the transition first, so a machine re-held (or slept by another sweep) since `r` was read is left alone. */
  private async sleep(r: Row, at: number): Promise<boolean> {
    const [won] = await this.q(`UPDATE machine_leases SET state='sleeping',container_id=NULL,holds=0,slept_at=$2,idle_since=NULL,keep_awake_until=NULL,warned_at=NULL,updated_at=$2 WHERE thread_id=$1 AND state='awake' AND holds=0 AND container_id=$3 AND idle_since IS NOT DISTINCT FROM $4 RETURNING thread_id`, [r.thread_id, this.at(at), r.container_id, r.idle_since]);
    if (!won) return false;
    await this.dispose(r);
    const charge = machineCharge(r.size, Math.max(0, Math.round((at - r.awake_since.getTime()) / 1000)));
    await this.q(`UPDATE threads SET spent = spent || jsonb_build_object('usd', (spent->>'usd')::numeric + $2::numeric, 'machineSec', (spent->>'machineSec')::numeric + $3::numeric) WHERE id=$1`, [r.thread_id, charge.usd, charge.machineSec]);
    await this.q(`INSERT INTO cost_entries (thread_id,run_id,source,delta) SELECT thread_id,id,'machine-estimate',$2 FROM runs WHERE thread_id=$1 ORDER BY ordinal DESC LIMIT 1`, [r.thread_id, JSON.stringify(charge)]);
    await this.hooks.emit?.(r.thread_id, { state: 'sleeping', machineSec: charge.machineSec, usdMicro: charge.usd }).catch(() => undefined);
    return true;
  }
  private async delete(r: Row): Promise<void> {
    if (!this.hooks.beforeDelete) {
      await this.hooks.emit?.(r.thread_id, { state: 'delete-blocked', reason: 'wip-capture-unavailable' }).catch(() => undefined);
      return;
    }
    const [won] = await this.q(`UPDATE machine_leases SET state='deleted',container_id=NULL,updated_at=$2 WHERE thread_id=$1 AND state='sleeping' AND slept_at=$3 RETURNING thread_id`, [r.thread_id, this.at(), r.slept_at]);
    if (!won) return;
    try { await this.hooks.beforeDelete(r.thread_id); } catch (err) {
      await this.q(`UPDATE machine_leases SET state='sleeping',updated_at=$2 WHERE thread_id=$1 AND state='deleted'`, [r.thread_id, this.at()]);
      await this.hooks.emit?.(r.thread_id, { state: 'delete-blocked', reason: (err as Error).message }).catch(() => undefined);
      return;
    }
    await this.dispose(r);
    await this.hooks.driver?.deleteWorkspace?.(r.thread_id).catch(() => undefined);
    await this.hooks.emit?.(r.thread_id, { state: 'deleted' }).catch(() => undefined);
  }
}

const cores = new Map<string, MachineCore>();
export function machineCore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): MachineCore {
  let core = cores.get(databaseUrl);
  if (!core) cores.set(databaseUrl, (core = new MachineCore(databaseUrl)));
  return core;
}
