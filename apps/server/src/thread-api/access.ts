type Db = { query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> };

/** SQL predicate on `threads t` for user param `user`, same rule as ThreadLifecycleStore.view: owner, any viewer of a shared thread, or a joined member. */
export const viewable = (user: string) =>
  `(t.owner_id=${user} OR t.visibility='shared' OR EXISTS (SELECT 1 FROM thread_members m WHERE m.thread_id=t.id AND m.user_id=${user} AND m.joined))`;

export async function canViewThread(db: Db, threadId: string, userId: string): Promise<boolean> {
  return (await db.query(`SELECT 1 FROM threads t WHERE t.id=$1 AND ${viewable('$2')}`, [threadId, userId])).rows.length > 0;
}
