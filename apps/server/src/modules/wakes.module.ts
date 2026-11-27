import { defaultWakeRouter } from '../routes/wakes.route.js';

export default {
  name: 'wakes',
  async start() {
    if (process.env.FLOTILLA_WAKES === '0' || !process.env.DATABASE_URL) return async () => undefined;
    const router = defaultWakeRouter();
    const stopListening = await router.listen(process.env.DATABASE_URL);
    const timer = setInterval(() => void router.sweep().catch((err) => console.error('wakes sweep', err)), 15_000);
    timer.unref();
    return async () => { clearInterval(timer); for (const a of router.aborts.values()) a.abort('shutdown'); await Promise.allSettled(router.jobs.values()); await stopListening(); };
  }
};
