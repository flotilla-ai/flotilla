CREATE TABLE IF NOT EXISTS issue_views (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  display jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,name)
);
ALTER TABLE issue_comments ADD COLUMN IF NOT EXISTS parent_id text REFERENCES issue_comments(id) ON DELETE SET NULL;
