ALTER TABLE paired_devices
  ADD COLUMN IF NOT EXISTS worktree_root text,
  ADD COLUMN IF NOT EXISTS transport jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS device_placements (
  thread_id text PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id text REFERENCES paired_devices(id) ON DELETE SET NULL,
  placement text NOT NULL CHECK (placement IN ('cloud','paired-device')),
  state text NOT NULL CHECK (state IN ('ready','waiting-reconnect','blocked')),
  isolation text NOT NULL CHECK (isolation IN ('container','dedicated-user')),
  git_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  waiting_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS device_imports (
  id text PRIMARY KEY,
  device_id text NOT NULL REFERENCES paired_devices(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('claude-code','codex')),
  path text NOT NULL,
  local_only boolean NOT NULL DEFAULT true,
  explicit_opt_in boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('accepted','rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
