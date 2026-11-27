CREATE TABLE IF NOT EXISTS drive_shares (
  id text PRIMARY KEY,
  item_id text NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  access text NOT NULL CHECK (access IN ('read', 'write')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS drive_shares_creator_idx ON drive_shares (created_by, revoked_at);
