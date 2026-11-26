import { serve } from '@hono/node-server';
import { createApp, startModules } from './loader.js';

const app = await createApp();
const stopModules = await startModules();
const server = serve({ fetch: app.fetch, port: 8080 }, (info) => {
  console.log(`server listening on ${info.port}`);
});

async function shutdown(): Promise<void> {
  await stopModules();
  server.close();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
