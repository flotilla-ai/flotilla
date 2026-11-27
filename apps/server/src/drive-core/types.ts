import { ApiFailure } from '../api-platform/types.js';

export type DriveItemId = `drv_${string}`;
/** SPEC §4 scopes plus Capy's Project+personal and Automation drives (CAPY-272). */
export type DriveScope =
  | { kind: 'org' } | { kind: 'user'; id: string } | { kind: 'project'; id: string }
  | { kind: 'project-user'; id: string; userId: string } | { kind: 'captain'; id: string } | { kind: 'automation'; id: string };
export type DriveScopeKind = DriveScope['kind'];
export interface DriveVersion { version: number; sha256: string; size: number; at: string; by: string; source: DriveSource }
export interface DriveItem {
  id: DriveItemId; parentId: DriveItemId | null; scope: DriveScope; path: string; name: string; type: 'file' | 'folder';
  blobSha256: string | null; size: number; version: number; mountIntoThreads: boolean; updatedAt: string;
}
/** How a Drive is placed on a thread machine: one directory per scope, copied in before the run and read back after it. */
export interface DriveMount { scope: DriveScope; dir: string; writable: boolean; files: { path: string; sha256: string; version: number }[] }
export type DriveSource = 'upload' | 'agent' | 'restore';
export interface DriveUsage { scope: DriveScope; usedBytes: number; limitBytes: number; full: boolean }
export type DriveFailureCode = 'drive_full' | 'file_too_large' | 'upload_too_large' | 'mount_failed' | 'save_failed';
/** A failure the user can act on: what happened and the next step. */
export interface DriveFailureCard { code: DriveFailureCode; title: string; nextStep: string }
export interface DriveLimits { uploadBytes: number; fileBytes: number; quotaBytes: number }
/** Most Drive bytes copied onto one machine per run. */
export const MOUNT_MAX_BYTES = 512 * 1024 * 1024;

export const MOUNT_ROOT = '/run/flotilla/drive';
export const DEFAULT_LIMITS: DriveLimits = {
  uploadBytes: 32_000_000,
  fileBytes: 100 * 1024 * 1024,
  quotaBytes: Number(process.env.FLOTILLA_DRIVE_QUOTA_BYTES ?? 10 * 1024 ** 3)
};
const DIRS: Record<DriveScopeKind, string> = { org: 'org', user: 'personal', project: 'project', 'project-user': 'project-personal', captain: 'captain', automation: 'automation' };
export const scopeDir = (s: DriveScope) => `${MOUNT_ROOT}/${DIRS[s.kind]}`;
export const scopeKey = (s: DriveScope) => s.kind === 'org' ? 'org' : s.kind === 'project-user' ? `project-user:${s.id}:${s.userId}` : `${s.kind}:${s.id}`;
export const scopeId = (s: DriveScope) => s.kind === 'org' ? '' : s.kind === 'project-user' ? `${s.id}:${s.userId}` : s.id;

/** `org`, `user`, `project:<id>`, `project-user:<id>`, `captain:<id>`, `automation:<id>`; personal scopes are always the caller's. */
export function parseScope(raw: unknown, userId: string): DriveScope {
  const [kind, id] = typeof raw === 'string' ? raw.split(/:(.*)/s) : [];
  if (kind === 'org' && !id) return { kind: 'org' };
  if (kind === 'user' && !id) return { kind: 'user', id: userId };
  if (id && /^[\w-]{1,80}$/.test(id)) {
    if (kind === 'project-user') return { kind, id, userId };
    if (kind === 'project' || kind === 'captain' || kind === 'automation') return { kind, id };
  }
  throw new ApiFailure('ValidationFailed', 'scope must be org, user, project:<id>, project-user:<id>, captain:<id> or automation:<id>');
}

export function parsePath(raw: unknown): string {
  const parts = typeof raw === 'string' ? raw.split('/').filter(Boolean) : [];
  if (!parts.length || (raw as string).length > 400 || parts.some((p) => p === '.' || p === '..' || p.length > 200 || /[\0\\]/.test(p))) throw new ApiFailure('ValidationFailed', 'path must be a relative path without . or .. segments');
  return parts.join('/');
}
/** `skills/<name>/SKILL.md` at a scope's root (CAPY-274). */
export const skillName = (path: string) => /^skills\/([a-z0-9][a-z0-9-]{0,63})\/SKILL\.md$/.exec(path)?.[1] ?? null;

export const CARDS: Record<DriveFailureCode, (detail: string) => DriveFailureCard> = {
  drive_full: (d) => ({ code: 'drive_full', title: 'Drive is full', nextStep: `Delete files or versions you no longer need, or raise FLOTILLA_DRIVE_QUOTA_BYTES (${d}).` }),
  file_too_large: (d) => ({ code: 'file_too_large', title: 'File is larger than 100 MiB', nextStep: `Split ${d} or keep it in the repository or an artifact store instead of Drive.` }),
  upload_too_large: (d) => ({ code: 'upload_too_large', title: 'Upload is larger than 32 MB', nextStep: `Upload ${d} in smaller parts, or have a thread write it to Drive (up to 100 MiB).` }),
  mount_failed: (d) => ({ code: 'mount_failed', title: 'Drive could not be mounted', nextStep: `This run started without Drive files (${d}). Check the machine has free disk and send the message again.` }),
  save_failed: (d) => ({ code: 'save_failed', title: 'Drive changes were not saved', nextStep: `The thread's edits to ${d} are still on the machine until it stops; fix the cause above and ask the thread to save again.` })
};
export class DriveFailure extends ApiFailure {
  constructor(readonly card: DriveFailureCard) { super(card.code === 'drive_full' || card.code.endsWith('too_large') ? 'PayloadTooLarge' : 'Internal', `${card.title}. ${card.nextStep}`); }
}

type TarEntry = { name: string; data: Buffer };
function header(name: string, size: number, type: string): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100); h.write('0000644\0', 100); h.write('0001000\0', 108); h.write('0001000\0', 116);
  h.write(size.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136); h.write('        ', 148); h.write(type, 156); h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}
const pad = (b: Buffer) => Buffer.concat([b, Buffer.alloc((512 - b.length % 512) % 512)]);
/** A ustar archive; names over 100 bytes get a PAX `path` record. */
export function tar(entries: TarEntry[]): Buffer {
  const out: Buffer[] = [];
  for (const e of entries) {
    if (Buffer.byteLength(e.name) > 100) {
      const rec = (n: number): string => { const s = `${n} path=${e.name}\n`; return Buffer.byteLength(s) === n ? s : rec(Buffer.byteLength(s)); };
      const pax = Buffer.from(rec(Buffer.byteLength(e.name) + 8));
      out.push(header('PaxHeader', pax.length, 'x'), pad(pax));
    }
    out.push(header(e.name.slice(0, 100), e.data.length, '0'), pad(e.data));
  }
  return Buffer.concat([...out, Buffer.alloc(1024)]);
}
/** Regular files of a tar (ustar prefix and PAX `path` aware); directories and links are skipped. */
export function untar(buf: Buffer): TarEntry[] {
  const files: TarEntry[] = []; let next: string | null = null;
  for (let off = 0; off + 512 <= buf.length;) {
    const h = buf.subarray(off, off + 512); if (h.every((b) => b === 0)) break;
    const str = (a: number, n: number) => h.subarray(a, a + n).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(str(124, 12).trim() || '0', 8); const type = str(156, 1) || '0'; const data = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') { next = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString('utf8'))?.[1] ?? null; continue; }
    const name = next ?? (str(345, 155) ? `${str(345, 155)}/${str(0, 100)}` : str(0, 100)); next = null;
    if (type === '0') files.push({ name, data: Buffer.from(data) });
  }
  return files;
}
