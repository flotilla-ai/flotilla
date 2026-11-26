import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const scrypt = promisify(scryptCb);
export type Session = { id: string; userId: string; csrfToken: string; expiresAt: Date };

export class AuthStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  private setupToken?: string;
  constructor(databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  async ensure(): Promise<void> {
    this.ready ??= (async () => {
      await this.pool.query(`CREATE TABLE IF NOT EXISTS flotilla_auth_credentials (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, password_hash text NOT NULL)`);
      await this.pool.query(`CREATE TABLE IF NOT EXISTS flotilla_setup_tokens (id integer PRIMARY KEY, token text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    })();
    await this.ready;
  }
  async userCount(): Promise<number> { await this.ensure(); return (await this.pool.query('SELECT count(*)::int n FROM users')).rows[0].n; }
  async getSetupToken(): Promise<string> {
    await this.ensure();
    if (await this.userCount() > 0) throw new Error('setup complete');
    if (!this.setupToken) {
      const row = await this.pool.query('SELECT token FROM flotilla_setup_tokens WHERE id=1');
      if (row.rows[0]) this.setupToken = row.rows[0].token;
      else {
        this.setupToken = randomBytes(24).toString('base64url');
        await this.pool.query('INSERT INTO flotilla_setup_tokens (id,token) VALUES (1,$1) ON CONFLICT (id) DO NOTHING', [this.setupToken]);
      }
    }
    return this.setupToken!;
  }
  async hash(password: string, salt?: Buffer): Promise<string> {
    salt ??= randomBytes(16);
    const hash = (await scrypt(password, salt, 32)) as Buffer;
    return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
  }
  async verify(password: string, stored: string): Promise<boolean> {
    const [, salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const actual = (await scrypt(password, Buffer.from(salt, 'base64'), 32)) as Buffer;
    const expected = Buffer.from(hash, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  async setup(email: string, password: string, token: string): Promise<{ userId: string } | null> {
    await this.ensure();
    if (await this.userCount() > 0) return null;
    const expected = await this.getSetupToken();
    if (Buffer.from(token).length !== Buffer.from(expected).length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return null;
    const userId = `usr_${randomBytes(8).toString('hex')}`;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO users (id,email,role) VALUES ($1,$2,$3)', [userId, email, 'admin']);
      await client.query('INSERT INTO flotilla_auth_credentials (user_id,password_hash) VALUES ($1,$2)', [userId, await this.hash(password)]);
      await client.query('COMMIT');
      return { userId };
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }
  async login(email: string, password: string): Promise<Session | null> {
    await this.ensure();
    const rows = await this.pool.query('SELECT u.id,c.password_hash FROM users u JOIN flotilla_auth_credentials c ON c.user_id=u.id WHERE u.email=$1', [email]);
    if (!rows.rows[0] || !(await this.verify(password, rows.rows[0].password_hash))) return null;
    return this.createSession(rows.rows[0].id);
  }
  async createSession(userId: string): Promise<Session> {
    const session = { id: `ses_${randomBytes(16).toString('hex')}`, userId, csrfToken: randomBytes(24).toString('base64url'), expiresAt: new Date(Date.now() + 30 * 86400_000) };
    await this.pool.query('INSERT INTO sessions (id,user_id,csrf_token,expires_at) VALUES ($1,$2,$3,$4)', [session.id, userId, session.csrfToken, session.expiresAt]);
    return session;
  }
  async session(id: string | undefined): Promise<Session | null> {
    if (!id) return null;
    await this.ensure();
    const rows = await this.pool.query('SELECT id,user_id,csrf_token,expires_at FROM sessions WHERE id=$1 AND expires_at > now()', [id]);
    const row = rows.rows[0];
    return row ? { id: row.id, userId: row.user_id, csrfToken: row.csrf_token, expiresAt: row.expires_at } : null;
  }
  async logout(id: string): Promise<void> { await this.pool.query('DELETE FROM sessions WHERE id=$1', [id]); }
}
const stores = new Map<string, AuthStore>();
export function authStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): AuthStore {
  let store = stores.get(databaseUrl);
  if (!store) {
    store = new AuthStore(databaseUrl);
    stores.set(databaseUrl, store);
  }
  return store;
}
export function cookieSession(cookie: string | undefined): string | undefined {
  return cookie?.split(';').map((x) => x.trim()).find((x) => x.startsWith('flotilla_session='))?.split('=')[1];
}
