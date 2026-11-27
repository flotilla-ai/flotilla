import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Envelope encryption: a fresh data key per value, wrapped by a key-encryption key the KMS holds. */
export type Kms = { keyId: string; seal(plain: Buffer, aad: string): Buffer; open(sealed: Buffer, aad: string): Buffer };

const VERSION = 1;
function gcm(key: Buffer, plain: Buffer, aad: string): Buffer {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(aad));
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}
function ungcm(key: Buffer, sealed: Buffer, aad: string): Buffer {
  const d = createDecipheriv('aes-256-gcm', key, sealed.subarray(0, 12)); d.setAAD(Buffer.from(aad)); d.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([d.update(sealed.subarray(28)), d.final()]);
}

/** Reads FLOTILLA_MASTER_KEY, else FLOTILLA_MASTER_KEY_FILE (generated 0600 on first use). Fails closed when neither is set. */
export function masterKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  if (env.FLOTILLA_MASTER_KEY) return Buffer.from(env.FLOTILLA_MASTER_KEY);
  const file = env.FLOTILLA_MASTER_KEY_FILE;
  if (!file) throw new Error('secrets vault: set FLOTILLA_MASTER_KEY_FILE or FLOTILLA_MASTER_KEY');
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, randomBytes(32).toString('base64url'), { mode: 0o600, flag: 'wx' });
  }
  chmodSync(file, 0o600);
  return Buffer.from(readFileSync(file, 'utf8').trim());
}

/** Self-hosted local KMS: the key-encryption key is derived from the master key and never stored. */
export function localKms(master: Buffer = masterKey()): Kms {
  const kek = Buffer.from(hkdfSync('sha256', master, 'flotilla-secrets', 'kek/v1', 32));
  const keyId = `local:${createHash('sha256').update(kek).digest('hex').slice(0, 16)}`;
  return {
    keyId,
    seal(plain, aad) {
      const dek = randomBytes(32);
      const wrapped = gcm(kek, dek, aad);
      return Buffer.concat([Buffer.from([VERSION]), wrapped, gcm(dek, plain, aad)]);
    },
    open(sealed, aad) {
      if (sealed[0] !== VERSION) throw new Error('secrets vault: unknown envelope version');
      const dek = ungcm(kek, sealed.subarray(1, 61), aad);
      return ungcm(dek, sealed.subarray(61), aad);
    }
  };
}
