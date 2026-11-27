CREATE TABLE IF NOT EXISTS thread_inbox (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  seq bigserial NOT NULL,
  root_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  mode text NOT NULL CHECK (mode IN ('queue', 'steer', 'interrupt')),
  plan boolean NOT NULL DEFAULT false,
  state text NOT NULL CHECK (state IN ('waiting_upload', 'pending', 'delivered', 'cancelled')),
  text text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_user text REFERENCES users(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 0,
  run_id text REFERENCES runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (root_id, version)
);
CREATE INDEX IF NOT EXISTS thread_inbox_pending_idx ON thread_inbox (thread_id, state, priority DESC, seq);

ALTER TABLE threads ADD COLUMN IF NOT EXISTS compact_at real CHECK (compact_at > 0 AND compact_at <= 1);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS plan_mode boolean NOT NULL DEFAULT false;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS error jsonb;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS gate text CHECK (gate IN ('plan'));
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
