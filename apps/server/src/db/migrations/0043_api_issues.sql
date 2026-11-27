CREATE TABLE IF NOT EXISTS issue_states (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  position integer NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO issue_states (id,name,position,is_default) VALUES
  ('ist_backlog','Backlog',1,true),('ist_todo','Todo',2,false),('ist_progress','In Progress',3,false),('ist_done','Done',4,false)
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS issue_labels (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  color text NOT NULL DEFAULT '#888888',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS issue_settings (
  id text PRIMARY KEY CHECK (id='org'),
  prefix text NOT NULL CHECK (prefix ~ '^[A-Z][A-Z0-9]{1,9}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO issue_settings (id,prefix) VALUES ('org','ISS') ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS issues (
  id text PRIMARY KEY,
  number bigserial,
  identifier text NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '',
  state_id text NOT NULL REFERENCES issue_states(id),
  assignee_id text REFERENCES users(id) ON DELETE SET NULL,
  creator_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date date,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS issue_comments (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS issue_events (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS issue_relations (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  other_issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('relates','blocks','parent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id,other_issue_id,type),
  CHECK (issue_id<>other_issue_id)
);
CREATE TABLE IF NOT EXISTS issue_links (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pull-request','thread')),
  target text NOT NULL CHECK (length(target) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id,kind,target)
);
CREATE TABLE IF NOT EXISTS issue_files (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  file_id text NOT NULL REFERENCES api_files(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id,file_id)
);
