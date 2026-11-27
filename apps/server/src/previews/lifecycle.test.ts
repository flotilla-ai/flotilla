import { execFile, spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { migrate } from '../db/migrate.js';
import { createPreviewServer } from '../modules/previews.module.js';
import { createPreviewsRoute } from '../routes/previews.route.js';
import { PreviewTokens } from './index.js';
import { dockerPreviewMachine, listeningPorts } from './machine.js';
import { previewStore, previewUrl } from './store.js';
import type { PreviewMachine } from './types.js';

const exec = promisify(execFile);
process.env.FLOTILLA_PREVIEW_URL = 'http://preview.test';
const T0 = Date.now(); let now = T0;
let container = ''; let store: ReturnType<typeof previewStore>; let pool: pg.Pool; let api: Hono; let proxy: Server; let upstream: Server; let base = '';
let listening = true; let user = 'usr_owner';
const seen: { host?: string; url?: string }[] = [];
const runs: string[] = [];
const proxyTokens = new PreviewTokens();
const machine = { asleep: false, runs,
  async state() { return machine.asleep ? 'asleep' as const : 'awake' as const; },
  async listening() { return [3000, 5173, 8080]; },
  async run(_code: string, command: string) { runs.push(command); listening = true; } };
const fakeMachine: PreviewMachine = machine;
const call = (path: string, method = 'GET', json?: unknown) => api.request(`http://local/api/v1${path}`, { method, headers: json ? { 'content-type': 'application/json' } : {}, body: json ? JSON.stringify(json) : undefined });
const open = async (url: string) => {
  const r = await fetch(url.replace('http://preview.test', base), { redirect: 'manual' });
  const loc = r.headers.get('location'); const ck = r.headers.get('set-cookie');
  return r.status === 302 && loc && ck ? fetch(new URL(loc, base), { redirect: 'manual', headers: { cookie: ck.split(';')[0] } }) : r;
};
async function share(port: number): Promise<string> { const r = await call(`/threads/thr_pv/previews/${port}/share`, 'POST', { ttlMinutes: 60 }); expect(r.status).toBe(200); return ((await r.json()) as { url: string }).url; }
async function awakeUntil(port: number): Promise<number> { return (await pool.query('SELECT awake_until FROM previews WHERE thread_id=$1 AND port=$2', ['thr_pv', port])).rows[0].awake_until.getTime(); }

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_owner','o@x','admin'),('usr_other','b@x','member')`);
  await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_pv','FLO-9','thread','usr_owner','preview','idle','{}','{}','{}')`);
  store = previewStore(pool, () => now);
  const route = createPreviewsRoute(new PreviewTokens(), pool, fakeMachine, store);
  api = new Hono(); api.use('*', async (c, next) => { c.set('userId' as never, user as never); await next(); }); api.route('/api/v1', route.app);
  upstream = createServer((req, res) => { seen.push({ host: req.headers.host, url: req.url }); res.end('app-ok'); }).listen(0);
  const upPort = (upstream.address() as AddressInfo).port;
  const dial = (_code: string, _port: number) => new Promise<Socket>((resolve, reject) => {
    if (!listening) { reject(new Error('gate denied')); return; }
    const s = connect(upPort, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  });
  proxy = createPreviewServer(proxyTokens, 'unused', { store, machine: fakeMachine, connect: dial, uiUrl: 'http://ui.test' }).listen(0);
  base = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
}, 60_000);
afterAll(async () => { proxy?.close(); upstream?.close(); await pool?.end(); if (container) spawn('sh', ['-c', `docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('preview lifecycle', () => {
  it('CAPY-221: suggests listening ports from the machine, hides reserved ports and refuses to expose them', async () => {
    expect(listeningPorts('  sl  local_address rem_address   st\n   0: 00000000:0BB8 00000000:0000 0A\n   1: 0100007F:1F90 00000000:0000 0A\n   2: 0100007F:D431 0100007F:0BB8 01\n')).toEqual([3000, 8080]);
    const before = await (await call('/threads/thr_pv/previews')).json() as { suggestions: number[]; reserved: number[] };
    expect(before.suggestions).toEqual([3000, 5173]);
    expect(before.reserved).toContain(8080);
    const refused = await call('/threads/thr_pv/previews/8081', 'PUT', {});
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ code: 'flotilla/ValidationFailed' });
    expect((await call('/threads/thr_pv/previews/3000', 'PUT', { startCommand: 'pnpm dev' })).status).toBe(200);
    const after = await (await call('/threads/thr_pv/previews')).json() as { suggestions: number[] };
    expect(after.suggestions).toEqual([5173]);
    user = 'usr_other';
    expect((await call('/threads/thr_pv/previews')).status).toBe(404);
    user = 'usr_owner';
  });

  it('CAPY-226: a thread without a PR has an in-machine URL for the machine browser plus the private preview URL', async () => {
    expect((await pool.query(`SELECT prs FROM threads WHERE id='thr_pv'`)).rows[0].prs).toEqual([]);
    const { previews } = await (await call('/threads/thr_pv/previews')).json() as { previews: { port: number; localUrl: string; url: string; access: string }[] };
    expect(previews[0]).toMatchObject({ port: 3000, localUrl: 'http://localhost:3000/', url: 'http://preview.test/p/FLO-9/3000/', access: 'private' });
  });

  it('CAPY-223: each request keeps the machine awake 5 more minutes up to 4 h; an asleep machine shows a Start the machine link', async () => {
    const url = await share(3000);
    expect((await open(url)).status).toBe(200);
    expect(await awakeUntil(3000)).toBe(T0 + 5 * 60_000);
    now = T0 + 4 * 60_000;
    expect((await open(url)).status).toBe(200);
    expect(await awakeUntil(3000)).toBe(T0 + 9 * 60_000);
    now = T0 + 4 * 3_600_000 - 60_000;
    await pool.query(`UPDATE previews SET awake_until=$1 WHERE thread_id='thr_pv' AND port=3000`, [new Date(now + 60_000)]);
    expect((await open(url)).status).toBe(200);
    expect(await awakeUntil(3000)).toBe(T0 + 4 * 3_600_000);
    machine.asleep = true;
    const asleep = await open(url);
    expect(asleep.status).toBe(503);
    const html = await asleep.text();
    expect(html).toContain('Start the machine');
    expect(html).toContain('href="http://ui.test/#/threads/thr_pv"');
    expect(await awakeUntil(3000)).toBe(T0 + 4 * 3_600_000);
    machine.asleep = false;
  });

  it('CAPY-224: the URL is stable across sleeps and the start command reruns when nothing is listening', async () => {
    const urlBefore = ((await (await call('/threads/thr_pv/previews')).json()) as { previews: { url: string }[] }).previews[0].url;
    machine.asleep = true;
    expect((await open(await share(3000))).status).toBe(503);
    machine.asleep = false; listening = false;
    const urlAfter = ((await (await call('/threads/thr_pv/previews')).json()) as { previews: { url: string }[] }).previews[0].url;
    expect(urlAfter).toBe(urlBefore);
    const link = await share(3000);
    const starting = await open(link);
    expect(starting.status).toBe(503);
    expect(starting.headers.get('refresh')).toBe('3');
    expect(await starting.text()).not.toContain('pnpm dev');
    expect(machine.runs).toEqual(['pnpm dev']);
    const execs: { Cmd: string[] }[] = [];
    const docker = { getContainer: () => ({ exec: async (o: { Cmd: string[] }) => { execs.push(o); return { start: async () => undefined }; } }) };
    await dockerPreviewMachine(docker as never).run('FLO-9', 'pnpm dev');
    expect(execs[0].Cmd.slice(0, 2)).toEqual(['sh', '-c']);
    expect(execs[0].Cmd.join(' ')).toContain('cd /workspace/repo');
    expect((await open(link)).status).toBe(200);
    listening = false;
    expect((await call('/threads/thr_pv/previews/4000', 'PUT', {})).status).toBe(200);
    const none = await open(await share(4000));
    expect(none.status).toBe(502);
    expect(await none.text()).toContain('Nothing is listening on port 4000');
    listening = true;
  });

  it('CAPY-225: portless-style hostname routers get the configured Host header', async () => {
    expect((await call('/threads/thr_pv/previews/1355', 'PUT', { hostname: 'web.localhost:1355' })).status).toBe(200);
    expect((await call('/threads/thr_pv/previews/1356', 'PUT', { hostname: 'bad host' })).status).toBe(400);
    seen.length = 0;
    expect(await (await open(await share(1355))).text()).toBe('app-ok');
    await open(await share(3000));
    expect(seen.map((s) => s.host)).toEqual(['web.localhost:1355', 'flt-FLO-9:3000']);
    const { previews } = await (await call('/threads/thr_pv/previews')).json() as { previews: { port: number; localUrl: string }[] };
    expect(previews.find((p) => p.port === 1355)?.localUrl).toBe('http://web.localhost:1355/');
  });

  it('share links flip access to shared, expire, and are revoked when access goes back to private', async () => {
    now += 1000;
    const link = await share(3000);
    let { previews } = await (await call('/threads/thr_pv/previews')).json() as { previews: { port: number; access: string; shareUntil: string }[] };
    expect(previews.find((p) => p.port === 3000)).toMatchObject({ access: 'shared', shareUntil: new Date(now + 3_600_000).toISOString() });
    expect((await open(link)).status).toBe(200);
    const first = await fetch(link.replace('http://preview.test', base), { redirect: 'manual' });
    expect(first.status).toBe(302);
    const shareCookie = first.headers.get('set-cookie')!;
    expect(shareCookie).toContain('Path=/p/FLO-9/3000;');
    expect(first.headers.get('location')).toBe('/p/FLO-9/3000/');
    const asset = await fetch(`${base}/p/FLO-9/3000/app.js`, { headers: { cookie: shareCookie.split(';')[0] } });
    expect(asset.status).toBe(200);
    now += 1000;
    expect((await call('/threads/thr_pv/previews/3000/share', 'DELETE')).status).toBe(200);
    expect((await open(link)).status).toBe(401);
    expect((await fetch(`${base}/p/FLO-9/3000/app.js`, { headers: { cookie: shareCookie.split(';')[0] } })).status).toBe(401);
    const priv = proxyTokens.exchange(proxyTokens.mint({ threadId: 'thr_pv', code: 'FLO-9', port: 3000, exp: Date.now() + 60_000 }))!;
    expect((await fetch(`${base}/p/FLO-9/3000/app.js`, { headers: { cookie: `${shareCookie.split(';')[0]}; flotilla_preview=${priv}` } })).status).toBe(200);
    ({ previews } = await (await call('/threads/thr_pv/previews')).json() as { previews: { port: number; access: string; shareUntil: string }[] });
    expect(previews.find((p) => p.port === 3000)?.access).toBe('private');
    expect((await call('/threads/thr_pv/previews/9999/share', 'POST', {})).status).toBe(404);
    const byCode = vi.spyOn(store, 'byCode');
    expect((await fetch(`${base}/p/FLO-9/3000/`)).status).toBe(401);
    expect((await fetch(`${base}/p/FLO-9/3000/`, { headers: { cookie: 'flotilla_share=forged; flotilla_preview=nope' } })).status).toBe(401);
    expect(byCode).not.toHaveBeenCalled(); byCode.mockRestore();
    const saved = process.env.FLOTILLA_PREVIEW_URL; delete process.env.FLOTILLA_PREVIEW_URL; process.env.FLOTILLA_DOMAIN = 'flotilla.example';
    expect(previewUrl('FLO-9', 3000)).toBe('http://flotilla.example:8081/p/FLO-9/3000/');
    process.env.FLOTILLA_PREVIEW_URL = saved; delete process.env.FLOTILLA_DOMAIN;
  });
});
