ALTER TABLE github_installations
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
