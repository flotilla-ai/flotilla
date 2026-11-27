ALTER TABLE approvals ADD COLUMN IF NOT EXISTS detail jsonb;
CREATE TABLE IF NOT EXISTS thread_reading_places (
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq bigint NOT NULL,
  offset_px integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
