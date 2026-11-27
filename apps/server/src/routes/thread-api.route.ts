import { Hono, type Context } from 'hono';
import { threadLifecycle } from '../thread-lifecycle/store.js';
import { THREAD_VERBS, toReadState, type ThreadMembershipMutation, type ThreadMutation } from '../thread-api/types.js';

const userId = (c: Context) => c.get('userId') as string;

/** Public REST verbs over ThreadLifecycleStore. Mutations return the caller's ThreadLifecycle view; leaving a private thread is 204. */
export function createThreadApiRoute(store = () => threadLifecycle()) {
  const app = new Hono();
  const run = async (c: Context, a: ThreadMutation | ThreadMembershipMutation) => {
    const view = await store().apply(c.req.param('id')!, userId(c), a);
    return view ? c.json(view) : c.body(null, 204);
  };
  app.post('/threads/:id/rename', async (c) => run(c, { action: 'rename', title: ((await c.req.json().catch(() => null)) ?? {}).title }));
  for (const action of THREAD_VERBS) app.post(`/threads/:id/${action}`, (c) => run(c, { action } as ThreadMutation | ThreadMembershipMutation));
  for (const action of ['read', 'unread'] as const) app.post(`/threads/:id/${action}`, async (c) => c.json(toReadState((await store().apply(c.req.param('id'), userId(c), { action }))!)));
  return { basePath: '/api/v1', app, public: false };
}
export default createThreadApiRoute();
