import { defaultRunner } from '../routes/threads.route.js';
export default {
  name: 'runner',
  async start() {
    const runner = defaultRunner();
    const resume = async () => { try { await runner.resumePending(); } catch { /* database not ready */ } };
    void resume(); const inbox = setInterval(resume, 2_000);
    const timer = setInterval(async () => {
      try {
        const rows = await runner.pool.query(`SELECT id FROM runs WHERE state IN ('starting','running') AND started_at < now() - interval '10 seconds'`);
        for (const row of rows.rows) await runner.pool.query(`INSERT INTO cost_entries (thread_id,run_id,source,delta) SELECT thread_id,id,'machine-estimate',jsonb_build_object('usd',0,'inputTokens',0,'outputTokens',0,'cacheTokens',0,'machineSec',10) FROM runs WHERE id=$1`, [row.id]);
      } catch { /* database not ready */ }
    }, 10_000);
    return async () => { clearInterval(timer); clearInterval(inbox); await runner.drain(); };
  }
};
