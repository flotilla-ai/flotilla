CREATE TABLE IF NOT EXISTS model_connections (
  id text PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('user', 'org')),
  owner_id text REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription', 'gateway', 'api-key', 'custom')),
  adapter text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status IN ('connected', 'needs-login', 'failed')),
  base_url text,
  env_var text,
  sealed_key bytea,
  key_id text,
  available_models jsonb NOT NULL DEFAULT '[]',
  excluded_models jsonb NOT NULL DEFAULT '[]',
  custom_models jsonb NOT NULL DEFAULT '[]',
  checked_at timestamptz,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'org') = (owner_id IS NULL))
);

CREATE TABLE IF NOT EXISTS model_favorites (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  models jsonb NOT NULL DEFAULT '[]'
);
