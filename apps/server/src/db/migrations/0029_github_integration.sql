CREATE TABLE IF NOT EXISTS github_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('personal', 'organization')),
  token_ref text,
  commit_identity text NOT NULL DEFAULT 'you-capy-coauthor' CHECK (commit_identity IN ('you-capy-coauthor', 'you', 'capy-you', 'capy')),
  commit_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, login)
);
CREATE TABLE IF NOT EXISTS github_installations (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES github_accounts(id) ON DELETE CASCADE,
  installation_id text NOT NULL UNIQUE,
  subject text NOT NULL,
  repositories jsonb NOT NULL DEFAULT '[]',
  permissions jsonb NOT NULL DEFAULT '{}',
  dependency_reader boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS github_pr_identities (
  repo text NOT NULL,
  number integer NOT NULL,
  identity text NOT NULL CHECK (identity IN ('you-capy-coauthor', 'you', 'capy-you', 'capy')),
  updated_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repo, number)
);
