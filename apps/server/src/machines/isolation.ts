import { KernelDenied } from '@flotilla/core/types';

type Inspect = {
  Name?: string;
  Config?: { User?: string };
  HostConfig?: {
    CapDrop?: string[]; SecurityOpt?: string[]; Binds?: string[]; Mounts?: { Source?: string; Destination?: string }[];
    PidsLimit?: number | null; Memory?: number; Privileged?: boolean;
  };
  NetworkSettings?: { Networks?: Record<string, unknown> };
};
type NetworkInspect = { Internal?: boolean; Containers?: Record<string, { Name?: string }> };

function deny(detail: string): never { throw new KernelDenied('isolation', detail); }

export function assertIsolated(container: Inspect, network: NetworkInspect): void {
  if (!container.Config?.User || container.Config.User === '0' || container.Config.User === 'root') deny('container runs as root');
  const host = container.HostConfig ?? {};
  if (!(host.CapDrop ?? []).includes('ALL')) deny('missing CapDrop ALL');
  if (!(host.SecurityOpt ?? []).some((x) => x.startsWith('no-new-privileges'))) deny('missing no-new-privileges');
  const mounts = [...(host.Binds ?? []), ...(host.Mounts ?? []).map((m) => `${m.Source}:${m.Destination}`)];
  if (mounts.some((m) => m.includes('/var/run/docker.sock'))) deny('docker socket mounted');
  if (!host.PidsLimit || host.PidsLimit <= 0) deny('missing pids limit');
  if (!host.Memory || host.Memory <= 0) deny('missing memory limit');
  if (host.Privileged) deny('privileged container');
  const networks = Object.keys(container.NetworkSettings?.Networks ?? {});
  if (networks.length !== 1) deny('container must have exactly one network');
  if (!network.Internal) deny('thread network is not internal');
  const members = Object.values(network.Containers ?? {}).map((c) => c.Name ?? '');
  const self = (container.Name ?? '').replace(/^\//, '');
  const nonGate = members.filter((name) => !name.includes('gate') && name !== self);
  if (members.length > 2 || nonGate.length > 0) deny('unexpected network member');
}
