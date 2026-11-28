export type HostCapacity = { vcpus: number; ramMb: number; diskFreeGb: number };
export type Quota = { vcpus: number; ramMb: number; diskGb: number; gpu?: 'none' };
export type ComputeAllocation = Quota & { id: string; state: 'running' | 'sleeping' | 'absent' | 'stopped' };
export type ReserveSettings = { ramMb: number; ramPercent: number; cpus: number; diskGb: number };
export type ComputeDecision = { decision: 'allow' | 'deny'; reason: string; remaining?: Quota };

export const defaultReserve: ReserveSettings = { ramMb: 2048, ramPercent: 25, cpus: 1, diskGb: 20 };
export const defaultCaptainQuota: Quota = { vcpus: 2, ramMb: 4096, diskGb: 32, gpu: 'none' };
export const minimumQuota: Quota = { vcpus: 1, ramMb: 2048, diskGb: 16, gpu: 'none' };

export function normalizeQuota(q: Partial<Quota> = {}): Quota {
  return {
    vcpus: Math.max(minimumQuota.vcpus, Math.floor(q.vcpus ?? defaultCaptainQuota.vcpus)),
    ramMb: Math.max(minimumQuota.ramMb, Math.floor(q.ramMb ?? defaultCaptainQuota.ramMb)),
    diskGb: Math.max(minimumQuota.diskGb, Math.floor(q.diskGb ?? defaultCaptainQuota.diskGb)),
    gpu: 'none'
  };
}

function active(allocations: ComputeAllocation[]): ComputeAllocation[] { return allocations.filter((a) => a.state === 'running'); }

/** Pure kernel compute guard. RAM never overcommits, CPU may overcommit at most 2x allocatable, disk uses at most 90% of free-after-reserve. */
export function decideCompute(capacity: HostCapacity, allocations: ComputeAllocation[], request: Partial<Quota> = {}, reserve: ReserveSettings = defaultReserve): ComputeDecision {
  const q = normalizeQuota(request);
  const running = active(allocations);
  const ramReserve = Math.max(reserve.ramMb, Math.floor(capacity.ramMb * reserve.ramPercent / 100));
  const allocatableRam = Math.max(0, capacity.ramMb - ramReserve);
  const allocatableCpu = Math.max(0, capacity.vcpus - reserve.cpus) * 2;
  const allocatableDisk = Math.max(0, Math.floor((capacity.diskFreeGb - reserve.diskGb) * 0.9));
  const used = running.reduce((acc, a) => ({ vcpus: acc.vcpus + a.vcpus, ramMb: acc.ramMb + a.ramMb, diskGb: acc.diskGb + a.diskGb }), { vcpus: 0, ramMb: 0, diskGb: 0 });
  const remaining = { vcpus: allocatableCpu - used.vcpus - q.vcpus, ramMb: allocatableRam - used.ramMb - q.ramMb, diskGb: allocatableDisk - used.diskGb - q.diskGb };
  if (remaining.ramMb < 0) return { decision: 'deny', reason: 'Not enough RAM: sleep Captain X or lower its RAM', remaining };
  if (remaining.vcpus < 0) return { decision: 'deny', reason: 'Not enough CPU: sleep Captain X or lower its vCPUs', remaining };
  if (remaining.diskGb < 0) return { decision: 'deny', reason: 'Not enough disk: free host disk or lower Captain disk', remaining };
  return { decision: 'allow', reason: 'fits', remaining };
}

/** Compose kernel and hook decisions: hooks may tighten but can never loosen. */
export function tightenComputeDecision(kernel: ComputeDecision, hook?: ComputeDecision): ComputeDecision {
  if (!hook) return kernel;
  return kernel.decision === 'deny' || hook.decision === 'deny' ? (hook.decision === 'deny' ? hook : kernel) : kernel;
}
