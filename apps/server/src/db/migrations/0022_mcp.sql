CREATE TABLE IF NOT EXISTS mcp_servers (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9-]{0,31}$'),
  name text NOT NULL,
  transport text NOT NULL CHECK (transport IN ('http', 'stdio')),
  url text,
  command jsonb,
  config jsonb NOT NULL DEFAULT '{}',
  sealed bytea NOT NULL,
  key_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  token_expires_at timestamptz,
  last_test jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, key)
);

CREATE TABLE IF NOT EXISTS mcp_oauth_flows (
  id text PRIMARY KEY,
  server_id text NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  verifier text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'done', 'cancelled', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_oauth_flows_server_idx ON mcp_oauth_flows (server_id, status);
