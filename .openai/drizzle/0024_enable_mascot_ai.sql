INSERT INTO mascot_settings (
  id,
  enabled,
  ai_enabled,
  disabled_pages,
  blocked_topics,
  updated_at,
  updated_by
)
VALUES (
  'global',
  1,
  1,
  '[]',
  '[]',
  CURRENT_TIMESTAMP,
  'BOOKNERD V47'
)
ON CONFLICT(id) DO UPDATE SET
  ai_enabled = 1,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

PRAGMA optimize;
