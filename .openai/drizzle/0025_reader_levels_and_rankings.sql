CREATE TABLE IF NOT EXISTS reader_level_stats (
  visitor_key TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  rank_key TEXT NOT NULL DEFAULT 'newcomer',
  completed_chapters INTEGER NOT NULL DEFAULT 0,
  completed_books INTEGER NOT NULL DEFAULT 0,
  completed_series INTEGER NOT NULL DEFAULT 0,
  approved_reviews INTEGER NOT NULL DEFAULT 0,
  confirmed_errors INTEGER NOT NULL DEFAULT 0,
  saved_quotes INTEGER NOT NULL DEFAULT 0,
  unique_reading_days INTEGER NOT NULL DEFAULT 0,
  completed_book_keys TEXT NOT NULL DEFAULT '[]',
  completed_series_keys TEXT NOT NULL DEFAULT '[]',
  public_visible INTEGER NOT NULL DEFAULT 1,
  online_visible INTEGER NOT NULL DEFAULT 1,
  current_book_visible INTEGER NOT NULL DEFAULT 1,
  planned_shelf_visible INTEGER NOT NULL DEFAULT 1,
  favorite_shelf_visible INTEGER NOT NULL DEFAULT 1,
  achievements_visible INTEGER NOT NULL DEFAULT 1,
  rating_status TEXT NOT NULL DEFAULT 'active',
  suspicious_reason TEXT NOT NULL DEFAULT '',
  first_counted_at TEXT,
  last_counted_at TEXT,
  recalculated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS reader_level_stats_public_id_unique
ON reader_level_stats(public_id);

CREATE INDEX IF NOT EXISTS reader_level_stats_public_rank_idx
ON reader_level_stats(public_visible, rating_status, total_xp DESC);

CREATE INDEX IF NOT EXISTS reading_sessions_visitor_completed_chapter_idx
ON reading_sessions(visitor_key, completed, chapter_id, book_id);

CREATE INDEX IF NOT EXISTS book_reviews_voter_status_created_idx
ON book_reviews(voter_key, status, created_at);

CREATE INDEX IF NOT EXISTS reader_error_reports_visitor_status_updated_idx
ON reader_error_reports(visitor_key, status, updated_at);

CREATE INDEX IF NOT EXISTS reader_public_notes_visitor_status_created_idx
ON reader_public_notes(visitor_key, status, created_at);

CREATE TABLE IF NOT EXISTS reader_monthly_stats (
  visitor_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  completed_chapters INTEGER NOT NULL DEFAULT 0,
  completed_books INTEGER NOT NULL DEFAULT 0,
  completed_series INTEGER NOT NULL DEFAULT 0,
  approved_reviews INTEGER NOT NULL DEFAULT 0,
  confirmed_errors INTEGER NOT NULL DEFAULT 0,
  unique_reading_days INTEGER NOT NULL DEFAULT 0,
  genre_count INTEGER NOT NULL DEFAULT 0,
  quotes_saved INTEGER NOT NULL DEFAULT 0,
  level_growth INTEGER NOT NULL DEFAULT 0,
  reached_xp_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (visitor_key, month_key)
);

CREATE INDEX IF NOT EXISTS reader_monthly_stats_ranking_idx
ON reader_monthly_stats(month_key, xp DESC, completed_books DESC, unique_reading_days DESC, completed_chapters DESC);

CREATE TABLE IF NOT EXISTS reader_achievements (
  visitor_key TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (visitor_key, achievement_key)
);

CREATE INDEX IF NOT EXISTS reader_achievements_unlocked_idx
ON reader_achievements(visitor_key, unlocked_at DESC);

CREATE TABLE IF NOT EXISTS reader_monthly_awards (
  visitor_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  nomination_key TEXT NOT NULL,
  title TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  awarded_by TEXT NOT NULL DEFAULT 'system',
  PRIMARY KEY (visitor_key, month_key, nomination_key)
);

CREATE INDEX IF NOT EXISTS reader_monthly_awards_reader_idx
ON reader_monthly_awards(visitor_key, awarded_at DESC);

CREATE TABLE IF NOT EXISTS reader_level_config (
  id TEXT PRIMARY KEY NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reader_xp_adjustments (
  id TEXT PRIMARY KEY NOT NULL,
  visitor_key TEXT NOT NULL,
  delta INTEGER NOT NULL,
  old_xp INTEGER NOT NULL,
  new_xp INTEGER NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS reader_xp_adjustments_reader_created_idx
ON reader_xp_adjustments(visitor_key, created_at DESC);

CREATE TABLE IF NOT EXISTS reader_month_finalizations (
  month_key TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

PRAGMA optimize;
