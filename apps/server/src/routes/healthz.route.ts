import { Hono } from 'hono';

const app = new Hono().get('/', (c) => c.text('ok'));

export default { basePath: '/healthz', app, public: true };
