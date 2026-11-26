CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  name text NOT NULL,
  repo jsonb NOT NULL,
  trust text NOT NULL CHECK (trust IN ('trusted', 'untrusted')),
  egress_allow jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS threads (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  project_id text REFERENCES projects(id),
  role text NOT NULL CHECK (role IN ('thread', 'captain')),
  parent_id text REFERENCES threads(id),
  crew_of text REFERENCES threads(id),
  owner_id text NOT NULL REFERENCES users(id),
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'working', 'waiting', 'paused', 'idle', 'failed', 'archived')),
  needs_you jsonb NOT NULL DEFAULT '[]'::jsonb,
  engine jsonb NOT NULL,
  machine_id text,
  branch text,
  prs jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget jsonb NOT NULL,
  spent jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  trigger jsonb NOT NULL,
  adapter_session_id text,
  state text NOT NULL CHECK (state IN ('starting', 'running', 'completed', 'cancelled', 'failed', 'paused_budget')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  usage jsonb NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  UNIQUE (thread_id, ordinal)
);

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  run_id text REFERENCES runs(id),
  kind text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('kernel', 'adapter', 'user', 'github', 'captain', 'automation', 'hook')),
  trust text NOT NULL CHECK (trust IN ('trusted', 'untrusted')),
  payload jsonb NOT NULL,
  request_id text,
  UNIQUE (thread_id, seq)
);

CREATE INDEX IF NOT EXISTS events_thread_request_idx ON events (thread_id, request_id);

CREATE TABLE IF NOT EXISTS approvals (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  captain_id text REFERENCES threads(id),
  kind text NOT NULL CHECK (kind IN ('conversation', 'decision', 'budget', 'merge', 'environment', 'mcp', 'credential', 'machine', 'hook-change')),
  question text NOT NULL,
  options jsonb NOT NULL,
  blocking boolean NOT NULL,
  state text NOT NULL CHECK (state IN ('open', 'answered', 'dismissed', 'expired')),
  answer jsonb
);

CREATE TABLE IF NOT EXISTS cost_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('vendor-usd', 'token-estimate', 'machine-estimate')),
  model text,
  delta jsonb NOT NULL,
  price_table_version text
);

CREATE TABLE IF NOT EXISTS budget_holds (
  scope text NOT NULL CHECK (scope IN ('thread', 'captain-subtree', 'project', 'global')),
  scope_id text NOT NULL,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (scope, scope_id, run_id)
);

CREATE TABLE IF NOT EXISTS captains (
  thread_id text PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  crew_runs_on text NOT NULL,
  max_concurrent_crew integer NOT NULL CHECK (max_concurrent_crew <= 5),
  drive_root text,
  digest_md text NOT NULL DEFAULT '',
  hook_bundle jsonb,
  wake_policy jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS prs (
  repo text NOT NULL,
  number integer NOT NULL,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  head_branch text NOT NULL,
  owned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repo, number)
);

CREATE INDEX IF NOT EXISTS events_thread_seq_idx ON events (thread_id, seq);
CREATE INDEX IF NOT EXISTS approvals_thread_state_idx ON approvals (thread_id, state);
CREATE INDEX IF NOT EXISTS cost_entries_run_idx ON cost_entries (run_id);
