ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'member', 'service'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_idempotency (
  principal_id text NOT NULL,
  request_id text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  fingerprint text NOT NULL DEFAULT '',
  status integer,
  body text,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (principal_id, request_id)
);

CREATE TABLE IF NOT EXISTS api_files (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  content_type text NOT NULL,
  size bigint NOT NULL,
  upload_token_hash text NOT NULL,
  upload_expires_at timestamptz NOT NULL,
  data bytea,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_files_owner_idx ON api_files (owner_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS automation_webhooks (
  secret_hash text PRIMARY KEY,
  automation_id text NOT NULL UNIQUE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_webhook_deliveries (
  id text PRIMARY KEY,
  automation_id text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
