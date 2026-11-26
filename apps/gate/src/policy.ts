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
function ipv4Public(ip: string): boolean {
  const n = ip.split('.').map(Number);
  const a = n[0], b = n[1];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}
function firstHextet(ip: string): number {
  const [head, tail] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const parts = ip.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : ip.split(':');
  return Number.parseInt(parts[0] || '0', 16);
}
export function isPublicIp(ip: string, ownSubnets: string[] = []): boolean {
  let version = isIP(ip);
  if (!version) return false;
  let normalized = ip.toLowerCase();
  const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) { normalized = mapped[1]; version = 4; }
  if (ownSubnets.some((own) => normalized === own || normalized.startsWith(`${own}.`))) return false;
  if (version === 4) return ipv4Public(normalized);
  const first = firstHextet(normalized);
  if (normalized === '::1' || normalized === '::') return false;
  if ((first & 0xff00) === 0xff00) return false;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  return true;
}
export function hostPort(authority: string): { host: string; port: number } | null {
  const m = /^\[?([^:\]]+)\]?:(\d+)$/.exec(authority);
  if (!m) return null;
  const port = Number(m[2]);
  return port > 0 && port <= 65535 ? { host: m[1].toLowerCase(), port } : null;
}
export async function decideConnect(host: string, rule: NetworkRule | undefined, resolver: Resolver, ownSubnets: string[] = []): Promise<Decision> {
  if (!rule) return { allow: false, reason: 'unknown-network' };
  if (!allowedByList(host, rule.allow)) return { allow: false, reason: 'not-allowlisted' };
  if (isIP(host)) return isPublicIp(host, ownSubnets) ? { allow: true, reason: 'allow', ip: host } : { allow: false, reason: 'private-ip' };
  let ips: string[];
  try { ips = await resolver(host); } catch { return { allow: false, reason: 'no-address' }; }
  if (!ips.length) return { allow: false, reason: 'no-address' };
  if (!ips.every((ip) => isPublicIp(ip, ownSubnets))) return { allow: false, reason: 'private-ip' };
  return { allow: true, reason: 'allow', ip: ips[0] };
}
