CREATE TABLE IF NOT EXISTS pr_draft_overrides (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  head_branch text NOT NULL,
  draft boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,repo,head_branch)
);
ALTER TABLE prs ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS pr_context_threads (
  repo text NOT NULL,
  number integer NOT NULL,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repo,number,thread_id)
);
