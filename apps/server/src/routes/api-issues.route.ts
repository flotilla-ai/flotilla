import { Hono, type Context } from 'hono';
import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import { ApiIssuesStore } from '../api-issues/index.js';

const user = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => { try { return await c.req.json() as Record<string, unknown>; } catch { throw new ApiFailure('ValidationFailed', 'request body must be valid JSON'); } };
const admin = async (c: Context, store: ApiIssuesStore) => store.requireAdmin(user(c));
let one: ApiIssuesStore | null = null;
export function apiIssuesStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') { one ??= new ApiIssuesStore(new pg.Pool({ connectionString: databaseUrl, max: 3 })); return one; }
export function createApiIssuesRoute(getStore = () => apiIssuesStore()) {
  const app = new Hono();
  app.get('/issues', async (c) => c.json(await getStore().listIssues({ stateId: c.req.query('stateId'), assigneeId: c.req.query('assigneeId'), labelId: c.req.query('labelId'), q: c.req.query('q') })));
  app.post('/issues', async (c) => c.json(await getStore().createIssue(user(c), await body(c)), 201));
  app.get('/issues/:id', async (c) => c.json(await getStore().getIssue(c.req.param('id'))));
  app.patch('/issues/:id', async (c) => c.json(await getStore().updateIssue(user(c), c.req.param('id'), await body(c))));
  app.get('/issues/:id/comments', async (c) => c.json(await getStore().listComments(c.req.param('id'))));
  app.post('/issues/:id/comments', async (c) => c.json(await getStore().addComment(user(c), c.req.param('id'), await body(c)), 201));
  app.get('/issues/:id/timeline', async (c) => c.json(await getStore().timeline(c.req.param('id'))));
  app.get('/issues/:id/relations', async (c) => c.json(await getStore().listRelations(c.req.param('id'))));
  app.post('/issues/:id/relations', async (c) => c.json(await getStore().relate(user(c), c.req.param('id'), await body(c)), 201));
  app.delete('/issues/:id/relations/:rid', async (c) => (await getStore().unrelate(user(c), c.req.param('id'), c.req.param('rid'))) ? c.body(null, 204) : c.body(null, 404));
  app.post('/issues/:id/links', async (c) => c.json(await getStore().link(user(c), c.req.param('id'), await body(c)), 201));
  app.delete('/issues/:id/links/:lid', async (c) => (await getStore().unlink(user(c), c.req.param('id'), c.req.param('lid'))) ? c.body(null, 204) : c.body(null, 404));
  app.post('/issues/:id/files', async (c) => c.json(await getStore().attachFiles(user(c), c.req.param('id'), await body(c)), 201));
  app.get('/issues/:id/files/:fileId/download', async (c) => {
    const f = await getStore().downloadFile(c.req.param('id'), c.req.param('fileId'));
    if (!f) throw new ApiFailure('NotFound', 'issue file not found');
    return new Response(f.data, { headers: { 'content-type': f.contentType, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}` } });
  });
  app.get('/issue-states', async (c) => c.json(await getStore().states()));
  app.post('/issue-states', async (c) => { const s = getStore(); await admin(c, s); return c.json(await s.createState(user(c), await body(c)), 201); });
  app.post('/issue-states/reorder', async (c) => { const s = getStore(); await admin(c, s); return c.json(await s.reorderStates(await body(c))); });
  app.patch('/issue-states/:id', async (c) => { const s = getStore(); await admin(c, s); return c.json(await s.updateState(c.req.param('id'), await body(c))); });
  app.delete('/issue-states/:id', async (c) => { const s = getStore(); await admin(c, s); return (await s.deleteState(c.req.param('id'))) ? c.body(null, 204) : c.body(null, 404); });
  app.post('/issue-states/:id/default', async (c) => { const s = getStore(); await admin(c, s); return c.json(await s.setDefaultState(c.req.param('id'))); });
  app.get('/issue-labels', async (c) => c.json(await getStore().labels()));
  app.post('/issue-labels', async (c) => { const s = getStore(); await admin(c, s); return c.json(await s.createLabel(await body(c)), 201); });
  app.patch('/issue-labels/:id', async (c) => { const s = getStore(); await admin(c, s); return c.json(await s.updateLabel(c.req.param('id'), await body(c))); });
  app.delete('/issue-labels/:id', async (c) => { const s = getStore(); await admin(c, s); return (await s.deleteLabel(c.req.param('id'))) ? c.body(null, 204) : c.body(null, 404); });
  app.get('/issue-settings/prefix', async (c) => c.json(await getStore().prefix()));
  app.put('/issue-settings/prefix', async (c) => { const s = getStore(); await admin(c, s); return c.json(await s.setPrefix(await body(c))); });
  return { basePath: '/api/v1', app, public: false };
}
export default createApiIssuesRoute();
