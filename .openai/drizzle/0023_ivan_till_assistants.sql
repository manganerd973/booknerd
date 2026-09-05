ALTER TABLE reader_profiles ADD COLUMN mascot_preferences TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS mascot_settings (
  id TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  disabled_pages TEXT NOT NULL DEFAULT '[]',
  blocked_topics TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mascot_dialogues (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL DEFAULT 'tip',
  pages TEXT NOT NULL DEFAULT '[]',
  lines TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS mascot_dialogues_active_dates_idx
ON mascot_dialogues(active, starts_at, ends_at);

PRAGMA optimize;
