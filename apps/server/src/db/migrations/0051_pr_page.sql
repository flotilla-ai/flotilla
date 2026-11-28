CREATE TABLE IF NOT EXISTS pr_draft_overrides (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  head_branch text NOT NULL,
  draft boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,repo,head_branch)
);
ALTER TABLE prs ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id) ON DELETE SET NULL;
