ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS state_changed_at timestamptz;
