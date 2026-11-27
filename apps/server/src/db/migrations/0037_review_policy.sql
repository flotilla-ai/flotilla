ALTER TABLE review_findings
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS review_policies (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  path_scope text NOT NULL DEFAULT '**',
  org_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  ignore_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  commit_status boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id,repo,path_scope)
);
CREATE TABLE IF NOT EXISTS review_guides (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  pr_number integer NOT NULL,
  overview text NOT NULL,
  steps jsonb NOT NULL,
  chapters jsonb NOT NULL,
  diagram text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
