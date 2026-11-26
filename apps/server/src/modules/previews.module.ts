import { createServer, request } from 'node:http';
import { connectThroughGate, verifyShareToken } from '../previews/index.js';
import { previewTokens } from '../routes/previews.route.js';
function cookie(req: string | undefined, name: string) { return req?.split(/; */).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1); }
function cleanPath(path: string): string {
  const url = new URL(path, 'http://preview');
  url.searchParams.delete('share'); url.searchParams.delete('token');
  return `${url.pathname}${url.search}` || '/';
}
export function createPreviewServer(tokens = previewTokens, gateHost = 'gate') {
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
    try {
      const socket = await connectThroughGate(code, port, process.env.GATE_ADMIN_TOKEN ?? '', gateHost);
      const upstream = request({
        createConnection: () => socket,
        method: req.method,
        path: cleanPath(req.url ?? '/'),
        headers: { host: `flt-${code}:${port}`, accept: req.headers.accept ?? '*/*', 'user-agent': req.headers['user-agent'] ?? 'flotilla-preview' }
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
  const server = createPreviewServer();
  server.listen(8081, () => console.log('previews listening on 8081'));
  return async () => { server.close(); };
} };
