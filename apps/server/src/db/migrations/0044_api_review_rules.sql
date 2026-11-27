CREATE TABLE IF NOT EXISTS api_review_rules (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  rule text NOT NULL CHECK (length(rule) BETWEEN 1 AND 2000),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id,repo,rule)
);
CREATE TABLE IF NOT EXISTS api_review_filter_rules (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  path_scope text NOT NULL DEFAULT '**' CHECK (length(path_scope) BETWEEN 1 AND 256),
  action text NOT NULL CHECK (action IN ('include','ignore')),
  pattern text NOT NULL CHECK (length(pattern) BETWEEN 1 AND 256),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id,repo,path_scope,action,pattern)
);
CREATE TABLE IF NOT EXISTS api_review_ignore_paths (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo text NOT NULL,
  path text NOT NULL CHECK (length(path) BETWEEN 1 AND 256),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id,repo,path)
);
