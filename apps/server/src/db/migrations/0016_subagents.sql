CREATE TABLE IF NOT EXISTS subagents (
  thread_id text PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  parent_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  address text NOT NULL,
  depth integer NOT NULL CHECK (depth BETWEEN 1 AND 3),
  prompt text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('shared', 'fresh')),
  mode text NOT NULL CHECK (mode IN ('parallel', 'stacked')),
  paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  stacked_on text REFERENCES threads(id) ON DELETE SET NULL,
  base_branch text,
  requested_usd double precision,
  granted_usd double precision,
  summary text,
  question text,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, ordinal),
  CHECK (placement = 'fresh' OR mode = 'parallel')
);
CREATE INDEX IF NOT EXISTS subagents_parent_idx ON subagents (parent_id);
