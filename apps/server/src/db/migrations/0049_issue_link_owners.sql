ALTER TABLE issue_links ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id) ON DELETE SET NULL;
UPDATE issue_links l SET created_by=e.actor_id FROM issue_events e WHERE l.created_by IS NULL AND e.issue_id=l.issue_id AND e.kind='linked' AND e.payload->>'kind'=l.kind AND e.payload->>'target'=l.target;
