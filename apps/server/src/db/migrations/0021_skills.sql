CREATE TABLE IF NOT EXISTS skills (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('repo', 'drive', 'plugin')),
  plugin text,
  repo_dir text,
  origin text NOT NULL DEFAULT '',
  name text NOT NULL,
  files jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skills_folder UNIQUE NULLS NOT DISTINCT (owner_id, project_id, source, plugin, repo_dir, name)
);

CREATE TABLE IF NOT EXISTS skill_disabled (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('builtin', 'repo', 'drive', 'plugin')),
  name text NOT NULL,
  PRIMARY KEY (owner_id, source, name)
);

CREATE TABLE IF NOT EXISTS skill_invocations (
  id bigserial PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id text,
  name text NOT NULL,
  source text NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('$', '/', '@', 'words')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skill_invocations_thread ON skill_invocations (thread_id, id);
