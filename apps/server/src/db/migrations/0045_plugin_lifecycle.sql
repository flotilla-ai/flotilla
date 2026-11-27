CREATE TABLE IF NOT EXISTS mcp_plugins (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('organization','user')),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9-]{0,63}$'),
  name text NOT NULL,
  repo text NOT NULL,
  path text NOT NULL DEFAULT '',
  ref text NOT NULL DEFAULT 'main',
  version text NOT NULL,
  spec jsonb NOT NULL,
  sealed bytea NOT NULL,
  key_id text NOT NULL,
  connection_mode text NOT NULL DEFAULT 'shared' CHECK (connection_mode IN ('shared','each-member')),
  private_threads_only boolean NOT NULL DEFAULT false,
  auto_update boolean NOT NULL DEFAULT false,
  update_state text NOT NULL DEFAULT 'current' CHECK (update_state IN ('current','available','needs-you')),
  pending_spec jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mcp_plugins_owner_scope_key_project_uidx ON mcp_plugins (owner_id,scope,key,COALESCE(project_id,''));
CREATE TABLE IF NOT EXISTS mcp_plugin_revisions (
  id text PRIMARY KEY,
  plugin_id text NOT NULL REFERENCES mcp_plugins(id) ON DELETE CASCADE,
  version text NOT NULL,
  spec jsonb NOT NULL,
  sealed bytea NOT NULL,
  key_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_plugin_revisions_plugin_idx ON mcp_plugin_revisions (plugin_id,created_at);
CREATE TABLE IF NOT EXISTS mcp_plugin_connections (
  id text PRIMARY KEY,
  plugin_id text NOT NULL REFERENCES mcp_plugins(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_key text NOT NULL,
  sealed bytea NOT NULL,
  key_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plugin_id,user_id,server_key)
);
