ALTER TABLE captains
  ADD COLUMN IF NOT EXISTS alias text,
  ADD COLUMN IF NOT EXISTS photo jsonb NOT NULL DEFAULT '{"kind":"none"}'::jsonb,
  ADD COLUMN IF NOT EXISTS crew_device_id text,
  ADD COLUMN IF NOT EXISTS machine_placement jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS captain_photos (
  captain_id text PRIMARY KEY REFERENCES captains(thread_id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
