import { Hono } from 'hono';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
const root = join(process.cwd(), 'apps/web/dist');
const types: Record<string,string> = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
export function createStaticRoute(dist = root) {
  const app = new Hono();
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) return c.notFound();
    const clean = normalize(c.req.path).replace(/^([/\\])+/, '');
    let file = join(dist, clean);
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) file = join(dist, 'index.html');
    if (!existsSync(file)) return c.text('web build missing', 404);
    return c.body(readFileSync(file), 200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  });
  return { basePath: '/', app, public: true };
}
export default createStaticRoute();
