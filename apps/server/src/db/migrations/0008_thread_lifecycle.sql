ALTER TABLE threads ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared'));
ALTER TABLE threads ADD COLUMN IF NOT EXISTS title_source text NOT NULL DEFAULT 'auto' CHECK (title_source IN ('auto', 'user'));
ALTER TABLE threads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS archived_from text;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS folder text;

CREATE TABLE IF NOT EXISTS thread_members (
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined boolean NOT NULL DEFAULT false,
  subscribed boolean NOT NULL DEFAULT false,
  last_read_seq integer NOT NULL DEFAULT 0,
  marked_unread boolean NOT NULL DEFAULT false,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS thread_members_user_idx ON thread_members (user_id);

CREATE TABLE IF NOT EXISTS thread_settings (
  scope text NOT NULL CHECK (scope IN ('org', 'user')),
  scope_id text NOT NULL,
  title_instructions text NOT NULL DEFAULT '',
  regenerate_when text CHECK (regenerate_when IN ('never', 'first-message', 'each-message')),
  auto_archive_days integer CHECK (auto_archive_days BETWEEN 0 AND 3650),
  PRIMARY KEY (scope, scope_id)
);
