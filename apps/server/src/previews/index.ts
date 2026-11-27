import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { connect as netConnect, type Socket } from 'node:net';

export type SharePayload = { threadId: string; code: string; port: number; exp: number };
const generated = randomBytes(32).toString('base64url');
const key = () => process.env.FLOTILLA_MASTER_KEY ?? generated;
function sign(body: string) { return createHmac('sha256', key()).update(body).digest('base64url'); }
export function shareToken(p: SharePayload): string { const body = Buffer.from(JSON.stringify(p)).toString('base64url'); return `${body}.${sign(body)}`; }
export function verifyShareToken(token: string): SharePayload | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const want = Buffer.from(sign(body), 'utf8'); const got = Buffer.from(sig, 'utf8');
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as SharePayload;
    return typeof p.threadId === 'string' && typeof p.code === 'string' && typeof p.port === 'number' && p.exp > Date.now() ? p : null;
  } catch { return null; }
}
export class PreviewTokens {
  private cookies = new Map<string, SharePayload>();
  mint(p: SharePayload) { const one = randomBytes(18).toString('base64url'); this.cookies.set(one, p); return one; }
  exchange(one: string) { const p = this.cookies.get(one); if (!p || p.exp <= Date.now()) return null; this.cookies.delete(one); const cookie = randomBytes(24).toString('base64url'); this.cookies.set(cookie, p); return cookie; }
  check(cookie: string, p: { threadId?: string; code?: string; port: number }) { const x = this.cookies.get(cookie); return !!x && x.exp > Date.now() && (!p.threadId || x.threadId === p.threadId) && (!p.code || x.code === p.code) && x.port === p.port; }
}
export async function connectThroughGate(code: string, port: number, token: string, gateHost = 'gate-edge', gatePort = 3128): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = netConnect(gatePort, gateHost, () => { s.write(`CONNECT flt-${code}:${port} HTTP/1.1\r\nHost: flt-${code}:${port}\r\nAuthorization: Bearer ${token}\r\n\r\n`); });
    let head = '';
    const timer = setTimeout(() => { s.destroy(); reject(new Error('gate timeout')); }, 5000);
    s.on('data', function on(d) {
      head += d.toString();
      if (!head.includes('\r\n\r\n')) return;
      s.removeListener('data', on); clearTimeout(timer);
      if (/^HTTP\/1\.[01] 200/.test(head)) resolve(s); else { s.destroy(); reject(new Error('gate denied')); }
    });
    s.once('error', (err) => { clearTimeout(timer); reject(err); });
  });
}
