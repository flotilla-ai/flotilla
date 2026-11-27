CREATE TABLE IF NOT EXISTS environment_versions (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  spec jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('user', 'agent', 'repo-file')),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  thread_id text REFERENCES threads(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  verification jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version)
);

CREATE TABLE IF NOT EXISTS environment_processes (
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('setup', 'startup', 'command')),
  name text NOT NULL,
  state text NOT NULL CHECK (state IN ('running', 'ready', 'passed', 'failed', 'timeout', 'stopped')),
  exit_code integer,
  output text NOT NULL DEFAULT '',
  head text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, kind, name)
);
