CREATE TABLE IF NOT EXISTS machine_networks (
  thread_id text PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('public', 'private', 'oidc')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS machine_background_commands (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  command text NOT NULL,
  cwd text NOT NULL DEFAULT '/workspace',
  pid integer,
  state text NOT NULL CHECK (state IN ('running', 'exited', 'stopped')) ,
  exit_code integer,
  output text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
