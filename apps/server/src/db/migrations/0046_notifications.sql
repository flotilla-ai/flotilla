CREATE TABLE IF NOT EXISTS notification_settings (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  requests boolean NOT NULL DEFAULT true,
  failures boolean NOT NULL DEFAULT true,
  sounds boolean NOT NULL DEFAULT false,
  system_alerts boolean NOT NULL DEFAULT true,
  device_push boolean NOT NULL DEFAULT false,
  slack_dm boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mention','failure','request','pr-followup')),
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id,created_at) WHERE read_at IS NULL;
