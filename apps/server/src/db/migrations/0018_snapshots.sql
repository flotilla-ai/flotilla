CREATE TABLE IF NOT EXISTS snapshot_specs (
  project_id text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  spec jsonb NOT NULL,
  requested boolean NOT NULL DEFAULT false,
  last_check_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snapshot_builds (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  thread_id text REFERENCES threads(id) ON DELETE SET NULL,
  environment_version integer NOT NULL,
  tier integer NOT NULL CHECK (tier IN (64, 128, 256)),
  state text NOT NULL CHECK (state IN ('running', 'succeeded', 'failed')),
  failed_step text CHECK (failed_step IN ('setup', 'repos', 'scrub', 'verify', 'capture')),
  used_gb double precision,
  images jsonb NOT NULL DEFAULT '[]',
  steps jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS snapshot_builds_project ON snapshot_builds (project_id, created_at DESC);
