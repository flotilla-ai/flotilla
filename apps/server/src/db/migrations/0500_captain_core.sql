CREATE TABLE IF NOT EXISTS computers (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state text NOT NULL,
  image text NOT NULL,
  container_name text NOT NULL,
  profile_volume text NOT NULL,
  network_name text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS computers_state_idx ON computers (state);

CREATE TABLE IF NOT EXISTS computer_screens (
  id text PRIMARY KEY,
  computer_id text NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  target_id text,
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS computer_screens_computer_state ON computer_screens (computer_id, state);
CREATE INDEX IF NOT EXISTS computer_screens_run ON computer_screens (run_id);

CREATE TABLE IF NOT EXISTS agent_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  thread_id text REFERENCES threads(id) ON DELETE SET NULL,
  run_id text REFERENCES runs(id) ON DELETE SET NULL,
  tool text NOT NULL,
  target text,
  classification text NOT NULL,
  decision text NOT NULL,
  approval_id text REFERENCES approvals(id) ON DELETE SET NULL,
  detail jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS agent_audit_thread_at ON agent_audit (thread_id, at DESC);
CREATE INDEX IF NOT EXISTS agent_audit_user_at ON agent_audit (user_id, at DESC);

ALTER TABLE rules_memory ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'fact';
ALTER TABLE rules_memory ADD COLUMN IF NOT EXISTS captain_id text REFERENCES captains(thread_id) ON DELETE CASCADE;
ALTER TABLE rules_memory DROP CONSTRAINT IF EXISTS rules_memory_scope_check;
ALTER TABLE rules_memory ADD CONSTRAINT rules_memory_scope_check CHECK (scope IN ('org', 'user', 'captain'));
CREATE INDEX IF NOT EXISTS rules_memory_captain ON rules_memory (captain_id, created_at DESC);
