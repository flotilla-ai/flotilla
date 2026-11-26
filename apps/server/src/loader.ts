import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { requireSession } from './auth/requireSession.js';

type Logger = Pick<Console, 'info' | 'warn' | 'error'>;
export type RouteModule = { basePath: string; app: Hono; public?: boolean };
export type LifecycleModule = { name: string; start(ctx: { log: Logger; env: NodeJS.ProcessEnv }): Promise<() => Promise<void>> };

const here = fileURLToPath(new URL('.', import.meta.url));

async function entries(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

function loadable(file: string, suffix: '.route' | '.module'): boolean {
  if (file.includes('.test.') || file.endsWith('.d.ts')) return false;
  return (file.endsWith(`${suffix}.ts`) || file.endsWith(`${suffix}.js`));
}

export async function loadRoutes(routesDir = join(here, 'routes')): Promise<RouteModule[]> {
  const routes: RouteModule[] = [];
  for (const file of await entries(routesDir)) {
    if (!loadable(file, '.route')) continue;
    const mod = await import(pathToFileURL(join(routesDir, file)).href);
    routes.push(mod.default);
  }
  return routes;
}

export async function loadModules(modulesDir = join(here, 'modules')): Promise<LifecycleModule[]> {
  const modules: LifecycleModule[] = [];
  for (const file of await entries(modulesDir)) {
    if (!loadable(file, '.module')) continue;
    const mod = await import(pathToFileURL(join(modulesDir, file)).href);
    modules.push(mod.default);
  }
  return modules;
}

function assertBasePath(basePath: string): void {
  if (basePath === '/healthz') return;
  if (basePath !== '/api/v1' && !basePath.startsWith('/api/v1/')) throw new Error(`route basePath must be /api/v1/*: ${basePath}`);
}

export async function createApp(opts: { routesDir?: string } = {}): Promise<Hono> {
  const app = new Hono();
  for (const route of await loadRoutes(opts.routesDir)) {
    assertBasePath(route.basePath);
    if (!route.public) {
      const base = route.basePath;
      app.use('*', async (c, next) => {
        if (c.req.path === base || c.req.path.startsWith(`${base}/`)) return requireSession(c, next);
        return next();
      });
    }
    app.route(route.basePath, route.app);
  }
  return app;
}

export async function startModules(opts: { modulesDir?: string; log?: Logger; env?: NodeJS.ProcessEnv } = {}): Promise<() => Promise<void>> {
  const log = opts.log ?? console;
  const env = opts.env ?? process.env;
  const stops: (() => Promise<void>)[] = [];
  for (const mod of await loadModules(opts.modulesDir)) {
    stops.push(await mod.start({ log, env }));
  }
  return async () => {
    for (const stop of stops.reverse()) await stop();
  };
}
