import Docker from 'dockerode';
import pg from 'pg';
import { DockerMachineDriver } from '../machines/dockerDriver.js';
import { reconcile } from '../machines/reaper.js';
import { migrate } from '../db/migrate.js';

export default {
  name: 'reaper',
  async start({ log, env }: { log: Pick<Console, 'info' | 'warn' | 'error'>; env: NodeJS.ProcessEnv }) {
    if (env.FLOTILLA_REAPER !== '1') return async () => {};
    const docker = new Docker();
    const driver = new DockerMachineDriver(docker);
    const poll = async () => {
      try {
        const containers = (await docker.listContainers({ all: true, filters: { label: ['flotilla.thread'] } })).map((c) => ({ id: c.Id, labels: c.Labels ?? {}, state: c.State }));
        if (!env.DATABASE_URL) return;
        await migrate(env.DATABASE_URL).catch((err) => log.warn(`reaper migration skipped: ${(err as Error).message}`));
        const db = new pg.Client({ connectionString: env.DATABASE_URL });
        await db.connect();
        const rows = await db.query<{ id: string; status: string }>('SELECT id, status FROM threads').finally(() => db.end().catch(() => undefined));
        const threads = rows.rows.map((r) => ({ id: r.id, state: r.status === 'archived' ? 'archived' as const : 'running' as const }));
        for (const action of reconcile(threads, containers)) {
          if (action.action === 'remove-orphan' && action.containerId) {
            log.warn(`reaper removing orphan ${action.containerId}`);
            await driver.remove(action.containerId);
          }
        }
      } catch (err) {
        log.warn(`reaper poll failed: ${(err as Error).message}`);
      }
    };
    const timer = setInterval(() => { void poll(); }, 5 * 60 * 1000);
    timer.unref();
    return async () => clearInterval(timer);
  }
};
