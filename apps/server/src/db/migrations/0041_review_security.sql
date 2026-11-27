ALTER TABLE github_installations
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE review_runs
  ADD COLUMN IF NOT EXISTS source_event_at timestamptz;
