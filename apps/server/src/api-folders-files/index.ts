import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import type { ApiPlatformStore } from '../api-platform/store.js';
import type { ThreadLifecycle } from '../thread-lifecycle/types.js';
import type { ThreadLifecycleStore } from '../thread-lifecycle/store.js';

export interface FolderSummary { name: string; threadCount: number }
export interface OrgUser { id: string; email: string; role: string }
export interface DownloadedFile { id: string; name: string; contentType: string; size: number; data: Buffer }

const folderName = (v: unknown): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > 80) throw new ApiFailure('ValidationFailed', 'folder must be 1-80 characters');
  return v.trim();
};

/** Public REST surface for thread folders/pins, uploaded attachments and organization users. */
export class ApiFoldersFilesStore {
  constructor(private readonly pool: pg.Pool, private readonly lifecycle: ThreadLifecycleStore, private readonly files: ApiPlatformStore) {}
  async folders(userId: string): Promise<{ items: FolderSummary[] }> {
    const counts = new Map<string, number>();
    for (const t of await this.lifecycle.list(userId)) if (t.folder) counts.set(t.folder, (counts.get(t.folder) ?? 0) + 1);
    return { items: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, threadCount]) => ({ name, threadCount })) };
  }
  async folderThreads(userId: string, rawName: string): Promise<{ items: ThreadLifecycle[] }> {
    const name = folderName(rawName);
    return { items: (await this.lifecycle.list(userId)).filter((t) => t.folder === name) };
  }
  async fileThread(userId: string, threadId: string, input: Record<string, unknown>): Promise<ThreadLifecycle | null> {
    return this.lifecycle.apply(threadId, userId, { action: 'file', folder: folderName(input.folder) });
  }
  async unfileThread(userId: string, threadId: string): Promise<ThreadLifecycle | null> {
    return this.lifecycle.apply(threadId, userId, { action: 'file', folder: null });
  }
  async setPinned(userId: string, threadId: string, pinned: boolean): Promise<ThreadLifecycle | null> {
    return this.lifecycle.apply(threadId, userId, { action: pinned ? 'pin' : 'unpin' });
  }
  async listUsers(): Promise<{ items: OrgUser[] }> {
    const rows = (await this.pool.query(`SELECT id,email,role FROM users WHERE role<>'service' ORDER BY email,id LIMIT 500`)).rows;
    return { items: rows.map((r) => ({ id: r.id, email: r.email, role: r.role })) };
  }

  async threadAttachments(userId: string, threadId: string): Promise<{ items: unknown[] }> {
    await this.lifecycle.view(threadId, userId);
    const rows = (await this.pool.query(`SELECT DISTINCT f.id,f.name,f.content_type,f.size,f.uploaded_at,f.created_at FROM thread_inbox i JOIN LATERAL jsonb_array_elements_text(i.attachments) a(x) ON true JOIN api_files f ON f.id=a.x WHERE i.thread_id=$1 AND f.owner_id=$2 ORDER BY f.created_at,f.id`, [threadId, userId])).rows;
    return { items: rows.map((r) => ({ id: r.id, name: r.name, contentType: r.content_type, size: Number(r.size), status: r.uploaded_at ? 'uploaded' : 'pending', createdAt: r.created_at.toISOString() })) };
  }
  async downloadFile(ownerId: string, id: string): Promise<DownloadedFile | null> {
    const meta = await this.files.getFile(ownerId, id);
    if (!meta || meta.status !== 'uploaded') return null;
    const r = (await this.pool.query('SELECT data FROM api_files WHERE id=$1 AND owner_id=$2', [id, ownerId])).rows[0];
    return r ? { id: meta.id, name: meta.name, contentType: meta.contentType, size: meta.size, data: r.data } : null;
  }
}
