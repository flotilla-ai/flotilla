ALTER TABLE computers ADD COLUMN IF NOT EXISTS backend text;
ALTER TABLE computers ADD COLUMN IF NOT EXISTS owner_captain_id text REFERENCES captains(thread_id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS computers_owner_default_unique ON computers (owner_id) WHERE owner_captain_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS computers_owner_captain_unique ON computers (owner_captain_id) WHERE owner_captain_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS compute_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  mode text NOT NULL DEFAULT 'off' CHECK (mode IN ('off', 'on')),
  backend text NOT NULL DEFAULT 'auto',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS computer_allocations (
  captain_id text PRIMARY KEY REFERENCES captains(thread_id) ON DELETE CASCADE,
  computer_id text REFERENCES computers(id) ON DELETE SET NULL,
  backend text NOT NULL DEFAULT 'docker-isolated',
  vcpus integer NOT NULL DEFAULT 2,
  ram_mb integer NOT NULL DEFAULT 4096,
  disk_gb integer NOT NULL DEFAULT 32,
  state text NOT NULL DEFAULT 'absent',
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vcpus >= 1),
  CHECK (ram_mb >= 2048),
  CHECK (disk_gb >= 16)
);
CREATE INDEX IF NOT EXISTS computer_allocations_state ON computer_allocations (state);
