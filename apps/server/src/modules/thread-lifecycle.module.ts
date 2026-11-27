import { threadLifecycle } from '../thread-lifecycle/store.js';

export default {
  name: 'thread-lifecycle',
  async start() {
    if (process.env.FLOTILLA_THREAD_LIFECYCLE === '0') return async () => undefined;
    const store = threadLifecycle();
    const stopListening = await store.listen();
    const sweep = () => void store.archiveIdle().catch((err) => console.error('thread-lifecycle idle sweep', err));
    const timer = setInterval(sweep, Number(process.env.FLOTILLA_ARCHIVE_SWEEP_MS ?? 3_600_000));
    timer.unref();
    sweep();
    return async () => { clearInterval(timer); await stopListening(); };
  }
};
