import { createServer, request, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import pg from 'pg';
import { connectThroughGate, verifyShareToken } from '../previews/index.js';
import { dockerPreviewMachine } from '../previews/machine.js';
import { previewStore, type PreviewStore } from '../previews/store.js';
import type { PreviewMachine } from '../previews/types.js';
import { previewTokens } from '../routes/previews.route.js';
import { gateToken } from '../gateClient/index.js';
function cookie(req: string | undefined, name: string) { return req?.split(/; */).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1); }
function cleanPath(path: string): string {
  const url = new URL(path, 'http://preview');
  url.searchParams.delete('share'); url.searchParams.delete('token');
  return `${url.pathname}${url.search}` || '/';
}
export type PreviewServerDeps = { store?: PreviewStore | null; machine?: PreviewMachine | null; connect?: (code: string, port: number) => Promise<Socket>; uiUrl?: string };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
function card(res: ServerResponse, status: number, title: string, body: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font:16px system-ui;background:#111;color:#ddd;padding:2rem"><h1>${esc(title)}</h1><p>${body}</p></body>`);
}
export function createPreviewServer(tokens = previewTokens, gateHost = 'gate-edge', deps: PreviewServerDeps = {}) {
  const dial = deps.connect ?? ((code: string, port: number) => connectThroughGate(code, port, gateToken(), gateHost));
  const uiUrl = (deps.uiUrl ?? process.env.FLOTILLA_PUBLIC_URL ?? 'http://localhost:8080').replace(/\/$/, '');
  const started = new Map<string, number>();
  return createServer((req, res) => { void (async () => {
    const m = /^\/p\/([^/]+)\/(\d+)(\/.*)?$/.exec(new URL(req.url ?? '/', 'http://preview').pathname);
    if (!m) { res.writeHead(404); res.end(); return; }
    const [, code, portS] = m; const port = Number(portS);
    const q = new URL(req.url ?? '', 'http://preview').searchParams;
    const token = q.get('token');
    if (token) {
      const previewCookie = tokens.exchange(token);
      if (!previewCookie) { res.writeHead(401); res.end(); return; }
      res.writeHead(302, { location: cleanPath(req.url ?? '/'), 'set-cookie': `flotilla_preview=${previewCookie}; Path=/p; HttpOnly; SameSite=Lax` }); res.end(); return;
    }
    const share = q.get('share') ? verifyShareToken(q.get('share')!) : null;
    if (share && (share.code !== code || share.port !== port)) { res.writeHead(401); res.end(); return; }
    const pc = cookie(req.headers.cookie, 'flotilla_preview');
    if (!share && !tokens.check(pc ?? '', { code, port })) { res.writeHead(401); res.end(); return; }
    const row = await deps.store?.byCode(code, port) ?? null;
    if (share && row?.share_revoked_at && (share.iat ?? 0) <= row.share_revoked_at.getTime()) { res.writeHead(401); res.end(); return; }
    if (deps.machine && await deps.machine.state(code) === 'asleep') {
      const link = `${uiUrl}/#/threads/${encodeURIComponent(row?.thread_id ?? share?.threadId ?? '')}`;
      card(res, 503, 'This machine is asleep', `<a href="${esc(link)}">Start the machine</a>, then reload this page. Only members can start it.`); return;
    }
    if (row) await deps.store!.touch(row);
    let socket: Socket;
    try { socket = await dial(code, port); } catch {
      const cmd = row?.start_command;
      if (!cmd || !deps.machine) { card(res, 502, `Nothing is listening on port ${port}`, 'Start the app inside the machine, then reload this page.'); return; }
      const key = `${code}:${port}`;
      if ((started.get(key) ?? 0) < Date.now() - 30_000) { started.set(key, Date.now()); await deps.machine.run(code, cmd).catch(() => undefined); }
      card(res, 503, 'Starting the app', `Nothing was listening on port ${port}, so <code>${esc(cmd)}</code> is running again. This page reloads.`, { refresh: '3', 'retry-after': '3' }); return;
    }
    try {
      const upstream = request({
        createConnection: () => socket,
        method: req.method,
        path: cleanPath(req.url ?? '/'),
        headers: { host: row?.hostname ?? `flt-${code}:${port}`, accept: req.headers.accept ?? '*/*', 'user-agent': req.headers['user-agent'] ?? 'flotilla-preview' }
      }, (ur) => {
        const headers = { ...ur.headers };
        delete headers['set-cookie']; delete headers.connection; delete headers['keep-alive']; delete headers['proxy-authenticate']; delete headers['proxy-authorization']; delete headers.te; delete headers.trailer; delete headers['transfer-encoding']; delete headers.upgrade;
        res.writeHead(ur.statusCode ?? 502, headers); ur.pipe(res);
      });
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(upstream);
    } catch { res.writeHead(502); res.end(); }
  })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); });
}
export default { name: 'previews', async start() {
  if (process.env.FLOTILLA_PREVIEW_LISTEN === '0') return async () => undefined;
  const store = process.env.DATABASE_URL ? previewStore(new pg.Pool({ connectionString: process.env.DATABASE_URL })) : null;
  const server = createPreviewServer(previewTokens, 'gate-edge', { store, machine: dockerPreviewMachine() });
  server.listen(8081, () => console.log('previews listening on 8081'));
  return async () => { server.close(); };
} };
