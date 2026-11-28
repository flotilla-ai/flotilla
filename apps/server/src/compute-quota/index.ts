import { cpus, totalmem } from 'node:os';
import { statfsSync } from 'node:fs';
import { decideCompute, defaultReserve, type ComputeAllocation, type ComputeDecision, type HostCapacity, type Quota, type ReserveSettings } from '@flotilla/core/kernel/computeGuard';

export type Queryable = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> };
export type CapacityProvider = { capacity(): Promise<HostCapacity> };
export type ComputeEvaluation = { enabled: boolean; decision: ComputeDecision; approvalId?: string; capacity?: HostCapacity };

export function detectHostCapacity(root = '/'): HostCapacity {
  const fs = statfsSync(root);
  return { vcpus: cpus().length, ramMb: Math.floor(totalmem() / 1024 / 1024), diskFreeGb: Math.floor(Number(fs.bavail) * Number((fs as unknown as { bsize?: number; frsize?: number }).bsize ?? (fs as unknown as { frsize?: number }).frsize ?? 0) / 1024 ** 3) };
}

const id = () => `cmp_${Math.random().toString(36).slice(2, 12)}`;

export class ComputeQuotaService {
  constructor(private deps: { pool: Queryable; provider?: CapacityProvider; enabled?: boolean; reserve?: ReserveSettings }) {}

  private enabled(): boolean {
    if (this.deps.enabled !== undefined) return this.deps.enabled;
    const v = process.env.FLOTILLA_COMPUTE_ISOLATION ?? '';
    return ['1', 'true', 'on'].includes(v.toLowerCase());
  }

  async evaluate(opts: { userId: string; threadId: string; captainId?: string; request?: Partial<Quota> }): Promise<ComputeEvaluation> {
    if (!this.enabled()) return { enabled: false, decision: { decision: 'allow', reason: 'isolation-off-zero-impact' } };
    const capacity = await (this.deps.provider ?? { capacity: async () => detectHostCapacity() }).capacity();
    const rows = await this.deps.pool.query(`SELECT captain_id as id,state,vcpus,ram_mb as "ramMb",disk_gb as "diskGb" FROM computer_allocations WHERE state='running'`);
    const decision = decideCompute(capacity, rows.rows as never as ComputeAllocation[], opts.request ?? {}, this.deps.reserve ?? defaultReserve);
    if (decision.decision === 'allow') return { enabled: true, decision, capacity };
    const approvalId = id();
    await this.deps.pool.query(
      `INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail)
       VALUES ($1,$2,'decision',$3,$4,true,'open',$5)`,
      [approvalId, opts.threadId, decision.reason, JSON.stringify([{ id: 'ok', label: 'OK' }]), JSON.stringify({ kind: 'compute', captainId: opts.captainId ?? null, request: opts.request ?? {}, capacity, reason: decision.reason })]
    );
    return { enabled: true, decision, approvalId, capacity };
  }

  async setAllocationState(captainId: string, state: 'running' | 'sleeping' | 'absent' | 'stopped', patch: Partial<Quota> = {}): Promise<unknown> {
    const rows = await this.deps.pool.query(
      `INSERT INTO computer_allocations (captain_id,state,vcpus,ram_mb,disk_gb)
       VALUES ($1,$2,COALESCE($3,2),COALESCE($4,4096),COALESCE($5,32))
       ON CONFLICT (captain_id) DO UPDATE SET state=excluded.state,
         vcpus=COALESCE($3,computer_allocations.vcpus),ram_mb=COALESCE($4,computer_allocations.ram_mb),disk_gb=COALESCE($5,computer_allocations.disk_gb),updated_at=now()
       RETURNING *`,
      [captainId, state, patch.vcpus ?? null, patch.ramMb ?? null, patch.diskGb ?? null]
    );
    return rows.rows[0];
  }

  async stopForBudget(captainId: string): Promise<unknown> { return this.setAllocationState(captainId, 'stopped'); }
}
