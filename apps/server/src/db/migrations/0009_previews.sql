CREATE TABLE IF NOT EXISTS previews (
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  hostname text,
  start_command text,
  share_until timestamptz,
  share_revoked_at timestamptz,
  awake_since timestamptz,
  awake_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, port)
);
