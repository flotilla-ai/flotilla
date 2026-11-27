CREATE TABLE IF NOT EXISTS event_order (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  next_pos bigint NOT NULL
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS pos bigint;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY at, thread_id, seq, id) AS pos
  FROM events
  WHERE pos IS NULL
)
UPDATE events e SET pos = ordered.pos FROM ordered WHERE e.id = ordered.id;

INSERT INTO event_order (id, next_pos)
SELECT true, COALESCE((SELECT max(pos) FROM events), 0) + 1
ON CONFLICT (id) DO NOTHING;

ALTER TABLE events ALTER COLUMN pos SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS events_pos_idx ON events (pos);

ALTER TABLE captain_scheduler_state ADD COLUMN IF NOT EXISTS last_event_pos bigint NOT NULL DEFAULT 0;
UPDATE captain_scheduler_state st
SET last_event_pos = COALESCE((SELECT max(e.pos) FROM events e WHERE e.at <= st.last_event_at), 0)
WHERE st.last_event_at > 'epoch'::timestamptz AND st.last_event_pos = 0;
