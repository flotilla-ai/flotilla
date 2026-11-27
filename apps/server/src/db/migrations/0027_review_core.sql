CREATE TABLE IF NOT EXISTS review_settings (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  automatic_mode text NOT NULL DEFAULT 'off' CHECK (automatic_mode IN ('off','once','every-push')),
  posting_threshold text NOT NULL DEFAULT 'medium' CHECK (posting_threshold IN ('low','medium','high')),
  include_investigate boolean NOT NULL DEFAULT false,
  include_notes boolean NOT NULL DEFAULT false,
  reviewed_once boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id,repo)
);
CREATE TABLE IF NOT EXISTS review_runs (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  pr_number integer NOT NULL CHECK (pr_number > 0),
  head_sha text NOT NULL,
  base_sha text,
  round integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','working','completed','failed')),
  source text NOT NULL CHECK (source IN ('pr-page','mention','api','push')),
  instructions text,
  effort text NOT NULL DEFAULT 'medium' CHECK (effort IN ('low','medium','high','flex')),
  credits integer NOT NULL,
  adapter text NOT NULL DEFAULT 'fake',
  connection_id text,
  read_only boolean NOT NULL DEFAULT true,
  checkout_exact_head boolean NOT NULL DEFAULT true,
  ready_override boolean NOT NULL DEFAULT false,
  last_reviewed_sha text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,repo,pr_number,round)
);
CREATE INDEX IF NOT EXISTS review_runs_owner_pr ON review_runs(owner_id,repo,pr_number,created_at DESC);
CREATE TABLE IF NOT EXISTS review_findings (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  pr_number integer NOT NULL,
  round integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('finding','note')),
  category text CHECK (category IN ('bug','risk','maintainability','refactor')),
  severity text CHECK (severity IN ('low','medium','high')),
  confidence text CHECK (confidence IN ('confirmed','investigate')),
  file text NOT NULL,
  line integer NOT NULL CHECK (line > 0),
  body text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','irrelevant')),
  github_thread_state text NOT NULL DEFAULT 'open' CHECK (github_thread_state IN ('open','resolved')),
  posted boolean NOT NULL DEFAULT false,
  superseded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS review_findings_round_fp ON review_findings(run_id,fingerprint) WHERE NOT superseded;
CREATE INDEX IF NOT EXISTS review_findings_pr ON review_findings(owner_id,repo,pr_number,round);
