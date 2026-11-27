type Db = { query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> };

/** Same visibility rule as ThreadLifecycleStore.view: owner, any viewer of a shared thread, or a joined member. */
export async function canViewThread(db: Db, threadId: string, userId: string): Promise<boolean> {
  const r = await db.query(`SELECT 1 FROM threads t LEFT JOIN thread_members m ON m.thread_id=t.id AND m.user_id=$2
    WHERE t.id=$1 AND (t.owner_id=$2 OR t.visibility='shared' OR m.joined IS TRUE)`, [threadId, userId]);
  return r.rows.length > 0;
}
