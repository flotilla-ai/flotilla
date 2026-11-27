CREATE TABLE IF NOT EXISTS secrets (
  id text PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('project', 'personal', 'thread')),
  scope_id text NOT NULL,
  name text NOT NULL,
  sealed bytea NOT NULL,
  key_id text NOT NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_id, name)
);
