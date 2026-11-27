ALTER TABLE projects ADD COLUMN IF NOT EXISTS machine_size text NOT NULL DEFAULT 'small' CHECK (machine_size IN ('small', 'medium', 'large', 'big-guy'));
CREATE TABLE IF NOT EXISTS machine_leases (
  thread_id text PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  size text NOT NULL,
  mem_mb integer NOT NULL,
  service boolean NOT NULL DEFAULT false,
  state text NOT NULL CHECK (state IN ('starting', 'awake', 'sleeping', 'deleted')),
  container_id text,
  holds integer NOT NULL DEFAULT 0,
  awake_since timestamptz,
  idle_since timestamptz,
  keep_awake_until timestamptz,
  slept_at timestamptz,
  warned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
