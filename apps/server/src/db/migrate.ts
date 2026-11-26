import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const localMigrations = fileURLToPath(new URL('./migrations', import.meta.url));
const sourceMigrations = fileURLToPath(new URL('../../src/db/migrations', import.meta.url));
const migrationDir = existsSync(localMigrations) ? localMigrations : sourceMigrations;

export async function migrate(databaseUrl: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS flotilla_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = new Set((await client.query<{ name: string }>('SELECT name FROM flotilla_migrations')).rows.map((r) => r.name));
    const names = (await readdir(migrationDir)).filter((n) => n.endsWith('.sql')).sort();
    const ran: string[] = [];
    for (const name of names) {
      if (applied.has(name)) continue;
      const sql = await readFile(join(migrationDir, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO flotilla_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        ran.push(name);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    return ran;
  } finally {
    await client.end();
  }
}
