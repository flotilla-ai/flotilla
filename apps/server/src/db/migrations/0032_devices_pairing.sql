CREATE TABLE IF NOT EXISTS paired_devices (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  trust text NOT NULL DEFAULT 'pending' CHECK (trust IN ('pending','trusted','revoked')),
  status text NOT NULL DEFAULT 'never-connected' CHECK (status IN ('never-connected','online','asleep','offline')),
  workspace_policy jsonb NOT NULL DEFAULT '{"kind":"new-worktree"}'::jsonb,
  project_folders jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{"keepAwakeWhileRunning":false,"cloudCheckpoints":true,"moveToCloudWhenOffline":false}'::jsonb,
  machine_metering text NOT NULL DEFAULT 'none' CHECK (machine_metering IN ('none')),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS device_pairing_codes (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
