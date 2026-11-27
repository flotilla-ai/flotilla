CREATE TABLE IF NOT EXISTS media_annotations (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pin','box')),
  x double precision NOT NULL,
  y double precision NOT NULL,
  width double precision,
  height double precision,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_annotations_thread_idx ON media_annotations(thread_id,media_url);
