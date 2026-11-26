import { isIP } from 'node:net';

export type Resolver = (host: string) => Promise<string[]>;
export type Decision = { allow: boolean; reason: string; ip?: string };
export type NetworkRule = { allow: string[]; edge?: boolean };

export function allowedByList(host: string, allow: string[]): boolean {
  const h = host.toLowerCase();
  return allow.some((rule) => {
    const r = rule.toLowerCase();
    return r === h || (r.startsWith('*.') && (h === r.slice(2) || h.endsWith(`.${r.slice(2)}`)));
  });
}
export function isPublicIp(ip: string, ownSubnets: string[] = []): boolean {
  const version = isIP(ip);
  if (!version) return false;
  if (ownSubnets.some((own) => ip === own || ip.startsWith(`${own}.`))) return false;
  if (version === 6) {
    const x = ip.toLowerCase();
    return !['::1', '::'].includes(x) && !x.startsWith('fc') && !x.startsWith('fd') && !x.startsWith('fe80') && !x.startsWith('ff');
  }
  const n = ip.split('.').map(Number);
  const a = n[0], b = n[1];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}
export function hostPort(authority: string): { host: string; port: number } | null {
  const m = /^\[?([^:\]]+)\]?:(\d+)$/.exec(authority);
  if (!m) return null;
  const port = Number(m[2]);
  return port > 0 && port <= 65535 ? { host: m[1].toLowerCase(), port } : null;
}
export async function decideConnect(host: string, rule: NetworkRule | undefined, resolver: Resolver): Promise<Decision> {
  if (!rule) return { allow: false, reason: 'unknown-network' };
  if (!allowedByList(host, rule.allow)) return { allow: false, reason: 'not-allowlisted' };
  if (isIP(host)) return isPublicIp(host) ? { allow: true, reason: 'allow', ip: host } : { allow: false, reason: 'private-ip' };
  const ips = await resolver(host);
  if (!ips.length) return { allow: false, reason: 'no-address' };
  if (!ips.every((ip) => isPublicIp(ip))) return { allow: false, reason: 'private-ip' };
  return { allow: true, reason: 'allow', ip: ips[0] };
}
