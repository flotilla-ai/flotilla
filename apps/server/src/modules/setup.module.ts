import { authStore } from '../auth/store.js';
import { migrate } from '../db/migrate.js';

export default {
  name: 'setup',
  async start({ log, env }: { log: Pick<Console, 'info' | 'warn' | 'error'>; env: NodeJS.ProcessEnv }) {
    const store = authStore(env.DATABASE_URL);
    try {
      if (env.DATABASE_URL) await migrate(env.DATABASE_URL);
      if (await store.userCount() === 0) log.info(`first-run setup token: ${await store.getSetupToken()}`);
    } catch (err) {
      log.warn(`setup token unavailable: ${(err as Error).message}`);
    }
    return async () => {};
  }
};
