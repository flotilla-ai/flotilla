import { readFileSync } from 'node:fs';
export function gateToken(): string { try { return readFileSync('/run/flotilla-gate/token','utf8').trim(); } catch { return process.env.GATE_ADMIN_TOKEN ?? ''; } }
export type GateAdmin = { putNetwork(name: string, allow: string[], gateIp?: string): Promise<void>; deleteNetwork(name: string): Promise<void> };
export function gateClient(baseUrl = process.env.GATE_ADMIN_URL ?? 'http://gate-edge:3129', token = gateToken()): GateAdmin {
  async function call(method: string, name: string, body?: object): Promise<void> {
    const res = await fetch(`${baseUrl}/networks/${encodeURIComponent(name)}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`gate ${method} ${name}: ${res.status}`);
  }
  return {
    putNetwork: async (name, allow, gateIp) => call('PUT', name, { allow, gateIp }),
    deleteNetwork: async (name) => call('DELETE', name)
  };
}
export function mergedAllowlist(adapterHosts: string[], projectAllow: string[]): string[] {
  return [...new Set([...adapterHosts, ...projectAllow])].sort();
}
