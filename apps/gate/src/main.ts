import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { connect as netConnect, type Socket } from 'node:net';
import { networkInterfaces } from 'node:os';
import { readFileSync } from 'node:fs';
import { decideConnect, hostPort, type NetworkRule, type Resolver } from './policy.js';
import { lookup } from 'node:dns/promises';

export type GateState = {
  byInterface: Map<string, NetworkRule>;
  byName: Map<string, NetworkRule>;
  interfaceForName: Map<string, string>;
};
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((x) => x.address);
function token(): string | null { try { return readFileSync('/run/flotilla-gate/token', 'utf8').trim(); } catch { return process.env.GATE_ADMIN_TOKEN ?? null; } }
function bearer(req: IncomingMessage): boolean { const t = token(); return t !== null && req.headers.authorization === `Bearer ${t}`; }
function logDecision(host: string, verdict: string): void { console.log(`gate host=${host} verdict=${verdict}`); }

export function createGate(state: GateState = { byInterface: new Map(), byName: new Map(), interfaceForName: new Map() }, resolver: Resolver = defaultResolver, upstreamHost = 'server') {
  const proxy = createServer((req, res) => { void proxyHttp(req, res, state, resolver); });
  proxy.on('connect', (req, socket, head) => { void proxyConnect(req, socket as Socket, head, state, resolver); });

  const relay = createServer((req, res) => {
    if ((req.headers.host ?? '').split(':')[0] !== 'flotilla-tools' || !(req.url ?? '').startsWith('/mcp/captain')) {
      res.writeHead(404); res.end(); return;
    }
    const upstream = request({ host: upstreamHost, port: 8082, path: req.url, method: req.method, headers: req.headers }, (ur) => {
      res.writeHead(ur.statusCode ?? 502, ur.headers); ur.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });

  const admin = createServer((req, res) => { void adminApi(req, res, state); });
  return { proxy, relay, admin, state };
}

async function readBody(req: IncomingMessage): Promise<string> { let x=''; for await (const c of req) x += c; return x; }
async function adminApi(req: IncomingMessage, res: ServerResponse, state: GateState): Promise<void> {
  if (!bearer(req)) { res.writeHead(401); res.end(); return; }
  const m = /^\/networks\/([^/]+)$/.exec(req.url ?? '');
  if (!m) { res.writeHead(404); res.end(); return; }
  const name = decodeURIComponent(m[1]);
  if (req.method === 'DELETE') {
    state.byName.delete(name);
    const iface = state.interfaceForName.get(name); if (iface) state.byInterface.delete(iface);
    state.interfaceForName.delete(name); res.writeHead(204); res.end(); return;
  }
  if (req.method !== 'PUT') { res.writeHead(405); res.end(); return; }
  const body = JSON.parse(await readBody(req) || '{}') as { allow?: string[]; gateIp?: string; edge?: boolean };
  const rule = { allow: body.allow ?? [], edge: body.edge };
  state.byName.set(name, rule);
  if (body.gateIp) { state.byInterface.set(body.gateIp, rule); state.interfaceForName.set(name, body.gateIp); }
  res.writeHead(204); res.end();
}
function localKey(socket: Socket): string { return (socket.localAddress ?? '').replace(/^::ffff:/, ''); }
function ownAddresses(): string[] { return Object.values(networkInterfaces()).flat().flatMap((x) => x?.address ? [x.address.replace(/^::ffff:/, '')] : []); }
function edgePreview(req: IncomingMessage, socket: Socket, state: GateState, host: string): boolean {
  const rule = state.byInterface.get(localKey(socket));
  return Boolean(rule?.edge && bearer(req) && /^flt-[A-Za-z0-9-]+$/.test(host));
}
async function proxyConnect(req: IncomingMessage, socket: Socket, head: Buffer, state: GateState, resolver: Resolver): Promise<void> {
  const target = hostPort(req.url ?? '');
  if (!target) { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
  const rule = state.byInterface.get(localKey(socket));
  let ip: string | undefined;
  if (/^flt-/.test(target.host)) {
    if (!edgePreview(req, socket, state, target.host)) { logDecision(target.host, 'deny-preview'); socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    ip = target.host;
  } else {
    try {
      const decision = await decideConnect(target.host, rule, resolver, ownAddresses());
      logDecision(target.host, decision.reason);
      if (!decision.allow) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
      ip = decision.ip;
    } catch { logDecision(target.host, 'deny-error'); socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  }
  const upstream = netConnect(target.port, ip, () => {
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) upstream.write(head);
    upstream.pipe(socket); socket.pipe(upstream);
  });
  upstream.on('error', () => socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
}
async function proxyHttp(req: IncomingMessage, res: ServerResponse, state: GateState, resolver: Resolver): Promise<void> {
  try {
    const url = new URL(req.url ?? '');
    const rule = state.byInterface.get(localKey(req.socket as Socket));
    const decision = await decideConnect(url.hostname, rule, resolver, ownAddresses());
    logDecision(url.hostname, decision.reason);
    if (!decision.allow) { res.writeHead(403); res.end(); return; }
    const upstream = request({ host: decision.ip, port: Number(url.port || 80), path: `${url.pathname}${url.search}`, method: req.method, headers: { ...req.headers, host: url.host } }, (ur) => {
      res.writeHead(ur.statusCode ?? 502, ur.headers); ur.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  } catch { res.writeHead(400); res.end(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gate = createGate();
  gate.proxy.listen(3128, () => console.log('gate proxy listening on 3128'));
  gate.relay.listen(80, () => console.log('gate relay listening on 80'));
  const edgeIp = Object.values(networkInterfaces()).flat().find((x) => x && x.family === 'IPv4' && !x.internal)?.address;
  gate.admin.listen(3129, edgeIp, () => console.log('gate admin listening on 3129'));
}
