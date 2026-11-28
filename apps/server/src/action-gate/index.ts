import { canOfferAlwaysAllow, classifyAction, decideAction, safeActionTarget, type ActionInput, type ActionRules, type GateDecision } from '@flotilla/core/kernel/actionGate';

export type Queryable = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> };
export type ActionEvaluation = {
  classification: ReturnType<typeof classifyAction>;
  decision: GateDecision;
  approvalId?: string;
  expired?: number;
};
export type EvaluateOptions = {
  userId: string;
  threadId: string;
  runId?: string | null;
  input: ActionInput;
  rules?: ActionRules;
  background?: boolean;
  now?: Date;
};

const id = () => `aga_${Math.random().toString(36).slice(2, 12)}`;

/** Server-side action gate decision/audit/approval persistence. Enforcement hooks must use this result as a ceiling, never as a floor. */
export class ActionGateService {
  constructor(private pool: Queryable) {}

  private async isDenied(threadId: string, signature: string): Promise<boolean> {
    const rows = await this.pool.query(
      `SELECT 1 FROM agent_audit a
       WHERE a.thread_id=$1 AND a.decision='deny' AND a.detail->>'signature'=$2
         AND a.at > COALESCE((SELECT max(e.at) FROM events e WHERE e.thread_id=$1 AND e.kind='user.message' AND e.source='user'), '-infinity'::timestamptz)
       UNION ALL
       SELECT 1 FROM approvals ap
       WHERE ap.thread_id=$1 AND ap.detail->>'kind'='action' AND ap.detail->>'signature'=$2
         AND ap.state='answered' AND ap.answer->>'optionId'='deny'
         AND (ap.answer->>'at')::timestamptz > COALESCE((SELECT max(e2.at) FROM events e2 WHERE e2.thread_id=$1 AND e2.kind='user.message' AND e2.source='user'), '-infinity'::timestamptz)
       LIMIT 1`,
      [threadId, signature]
    );
    return rows.rows.length > 0;
  }

  private async audit(opts: EvaluateOptions, classification: ActionEvaluation['classification'], decision: GateDecision, approvalId?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_audit (user_id,thread_id,run_id,tool,target,classification,decision,approval_id,detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [opts.userId, opts.threadId, opts.runId ?? null, opts.input.tool, safeActionTarget(opts.input.url) || opts.input.text?.split(/[?#]/, 1)[0] || null, classification.class === 'consequential' ? classification.kind : classification.class, decision.decision, approvalId ?? null, JSON.stringify({ signature: decision.signature, reason: decision.reason })]
    );
  }

  async evaluate(opts: EvaluateOptions): Promise<ActionEvaluation> {
    if (opts.runId) {
      const run = await this.pool.query('SELECT 1 FROM runs WHERE id=$1 AND thread_id=$2', [opts.runId, opts.threadId]);
      if (!run.rows.length) throw new Error('run does not belong to thread');
    }
    const classification = classifyAction(opts.input);
    const first = decideAction(opts.input, classification, opts.rules ?? {});
    const denied = new Set(await this.isDenied(opts.threadId, first.signature) ? [first.signature] : []);
    const decision = decideAction(opts.input, classification, opts.rules ?? {}, denied);
    if (decision.decision !== 'ask') {
      await this.audit(opts, classification, decision);
      return { classification, decision };
    }
    const approvalId = id();
    const options = [
      { id: 'allow-once', label: 'Allow once' },
      ...(canOfferAlwaysAllow(classification) ? [{ id: 'always-allow', label: 'Always allow' }] : []),
      { id: 'deny', label: 'Deny' }
    ];
    const expiresAt = opts.background ? new Date((opts.now ?? new Date()).getTime() + 30 * 60_000).toISOString() : null;
    await this.pool.query(
      `INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail)
       VALUES ($1,$2,'decision',$3,$4,true,'open',$5)`,
      [approvalId, opts.threadId, `Allow ${classification.class === 'consequential' ? classification.kind : classification.class} action: ${opts.input.tool}?`, JSON.stringify(options), JSON.stringify({ kind: 'action', input: opts.input, classification, signature: decision.signature, expiresAt })]
    );
    await this.audit(opts, classification, decision, approvalId);
    return { classification, decision, approvalId };
  }

  /** Record a Deny answer so the same signature is refused until the next user.message event in that thread. */
  async recordDeny(opts: EvaluateOptions, signature: string): Promise<void> {
    const classification = classifyAction(opts.input);
    await this.audit(opts, classification, { decision: 'deny', reason: 'user-denied', signature });
  }

  async expireBackground(now = new Date(), userId?: string): Promise<number> {
    const rows = await this.pool.query(
      `UPDATE approvals a SET state='expired' FROM threads t
       WHERE t.id=a.thread_id AND ($2::text IS NULL OR t.owner_id=$2)
         AND a.state='open' AND a.kind='decision' AND a.detail->>'kind'='action'
         AND a.detail->>'expiresAt' IS NOT NULL AND (a.detail->>'expiresAt')::timestamptz < $1`,
      [now.toISOString(), userId ?? null]
    );
    return rows.rowCount ?? 0;
  }
}
