import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, startModules } from './loader.js';

let dirs: string[] = [];
async function fixture(): Promise<{ routes: string; modules: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'flotilla-loader-'));
  dirs.push(dir);
  const routes = join(dir, 'routes');
  const modules = join(dir, 'modules');
  await mkdir(routes, { recursive: true });
  await mkdir(modules, { recursive: true });
  return { routes, modules };
}

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

describe('server loader', () => {
  it('mounts public routes and ignores tests/helpers', async () => {
    const { routes } = await fixture();
    await writeFile(join(routes, 'x.route.ts'), `import { Hono } from 'hono';
export default { basePath: '/api/v1/x', public: true, app: new Hono().get('/', c => c.text('x')) };
`);
    await writeFile(join(routes, 'x.route.test.ts'), `throw new Error('test loaded');
`);
    await writeFile(join(routes, 'helper.ts'), `throw new Error('helper loaded');
`);
    const app = await createApp({ routesDir: routes });
    const res = await app.request('http://local/api/v1/x');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('x');
  });

  it('puts non-public routes behind the fail-closed session stub', async () => {
    const { routes } = await fixture();
    await writeFile(join(routes, 'x.route.ts'), `import { Hono } from 'hono';
export default { basePath: '/api/v1/private', app: new Hono().get('/', c => c.text('secret')) };
`);
    const app = await createApp({ routesDir: routes });
    const res = await app.request('http://local/api/v1/private');
    expect(res.status).toBe(401);
  });

  it('starts and stops lifecycle modules', async () => {
    const { modules } = await fixture();
    await writeFile(join(modules, 'x.module.ts'), `export default { name: 'x', async start() { (globalThis as any).__started = true; return async () => { (globalThis as any).__stopped = true; }; } };
`);
    const stop = await startModules({ modulesDir: modules, log: console, env: {} });
    expect((globalThis as { __started?: boolean }).__started).toBe(true);
    await stop();
    expect((globalThis as { __stopped?: boolean }).__stopped).toBe(true);
  });
});
