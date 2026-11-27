CREATE TABLE IF NOT EXISTS rules_instructions (
  scope text NOT NULL CHECK (scope IN ('org', 'user', 'project')),
  subject_id text NOT NULL,
  text text NOT NULL DEFAULT '',
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, subject_id)
);

CREATE TABLE IF NOT EXISTS rules_experiments (
  scope text NOT NULL CHECK (scope IN ('org', 'user')),
  subject_id text NOT NULL,
  memory boolean,
  captain boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, subject_id)
);

CREATE TABLE IF NOT EXISTS rules_memory (
  id text PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('org', 'user')),
  subject_id text NOT NULL,
  text text NOT NULL,
  thread_id text REFERENCES threads(id) ON DELETE SET NULL,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rules_memory_subject ON rules_memory (scope, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rules_context (
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  breakdown jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, run_id)
);
