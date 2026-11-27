ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS max_runs_per_day integer CHECK (max_runs_per_day IS NULL OR max_runs_per_day > 0),
  ADD COLUMN IF NOT EXISTS drive_scope jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS output jsonb NOT NULL DEFAULT '{}'::jsonb;
