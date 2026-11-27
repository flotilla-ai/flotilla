CREATE TABLE IF NOT EXISTS wake_settings (
  scope text NOT NULL CHECK (scope IN ('org', 'user')),
  scope_id text NOT NULL,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  bots jsonb,
  allow_bots jsonb,
  merge_window_days integer CHECK (merge_window_days BETWEEN 0 AND 365),
  PRIMARY KEY (scope, scope_id)
);

CREATE TABLE IF NOT EXISTS wake_watches (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('timer', 'pr', 'thread', 'job')),
  target text NOT NULL,
  label text NOT NULL,
  url text,
  fire_at timestamptz,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'fired', 'stopped')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wake_watches_active_idx ON wake_watches (state, kind, fire_at);

CREATE TABLE IF NOT EXISTS wake_inbox (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind text NOT NULL,
  text text NOT NULL,
  from_user text,
  from_thread text,
  state text NOT NULL CHECK (state IN ('held', 'context', 'delivered', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wake_inbox_thread_idx ON wake_inbox (thread_id, state, created_at);

ALTER TABLE threads ADD COLUMN IF NOT EXISTS hold_incoming boolean NOT NULL DEFAULT false;
