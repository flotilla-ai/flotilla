CREATE TABLE IF NOT EXISTS watches (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('github-event','slack-channel','webhook-url')),
  target jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','cancelled','fired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  fired_at timestamptz
);
CREATE INDEX IF NOT EXISTS watches_active_target_idx ON watches(target_type,state,expires_at);
CREATE TABLE IF NOT EXISTS captain_shares (
  captain_id text NOT NULL REFERENCES captains(thread_id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('org','user')),
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(captain_id,subject_type,subject_id)
);
CREATE TABLE IF NOT EXISTS captain_access_audit (
  id text PRIMARY KEY,
  captain_id text NOT NULL REFERENCES captains(thread_id) ON DELETE CASCADE,
  actor_id text NOT NULL REFERENCES users(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
