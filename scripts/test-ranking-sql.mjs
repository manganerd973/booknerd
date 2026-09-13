import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  CREATE TABLE books (id TEXT PRIMARY KEY, title TEXT, slug TEXT, cover_key TEXT, status TEXT, series_title TEXT, genres TEXT, tropes TEXT, published INTEGER);
  CREATE TABLE chapters (id TEXT PRIMARY KEY, book_id TEXT, status TEXT);
  CREATE TABLE reading_sessions (visitor_key TEXT, chapter_id TEXT, book_id TEXT, reading_date TEXT, seconds INTEGER DEFAULT 0, max_progress INTEGER DEFAULT 0, completed INTEGER DEFAULT 0, notification_return INTEGER DEFAULT 0, started_at TEXT, updated_at TEXT, PRIMARY KEY(visitor_key, chapter_id, reading_date));
  CREATE TABLE reader_library (visitor_key TEXT, book_id TEXT, status TEXT, progress INTEGER, last_opened_at TEXT, updated_at TEXT, PRIMARY KEY(visitor_key, book_id));
  CREATE TABLE book_reviews (id TEXT PRIMARY KEY, book_id TEXT, voter_key TEXT, body TEXT, status TEXT, created_at TEXT);
  CREATE TABLE reader_error_reports (id TEXT PRIMARY KEY, visitor_key TEXT, chapter_id TEXT, paragraph_index INTEGER, selected_text TEXT, status TEXT, updated_at TEXT);
  CREATE TABLE reader_profiles (visitor_key TEXT PRIMARY KEY, display_name TEXT, photo_key TEXT, favorite_quotes TEXT DEFAULT '[]', favorite_characters TEXT DEFAULT '[]', created_at TEXT, updated_at TEXT);
  CREATE TABLE reader_public_notes (id TEXT PRIMARY KEY, visitor_key TEXT, status TEXT, created_at TEXT);
  CREATE TABLE reader_notifications (id TEXT PRIMARY KEY, visitor_key TEXT, event_key TEXT, type TEXT, book_id TEXT, chapter_id TEXT, comment_id TEXT, actor_name TEXT, title TEXT, body TEXT, url TEXT, read_at TEXT, hidden_at TEXT, created_at TEXT);
`);
sqlite.exec(readFileSync(new URL('../.openai/drizzle/0025_reader_levels_and_rankings.sql', import.meta.url), 'utf8'));

const now = '2026-09-12T12:00:00.000Z';
const statsInsert = sqlite.prepare(`INSERT INTO reader_level_stats (visitor_key, public_id, total_xp, level, rank_key, completed_chapters, completed_books, unique_reading_days, favorite_genres, public_visible, rating_status, created_at, updated_at, first_counted_at) VALUES (?, ?, ?, ?, 'newcomer', ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
statsInsert.run('reader-a', 'publicreader000000001', 200, 4, 10, 1, 3, '["Фэнтези"]', 1, 'active', now, now, now);
statsInsert.run('reader-b', 'publicreader000000002', 200, 4, 9, 2, 4, '["Романтика"]', 1, 'active', now, now, '2026-09-11T12:00:00.000Z');
statsInsert.run('reader-c', 'publicreader000000003', 999, 8, 50, 8, 8, '["Триллер"]', 0, 'active', now, now, now);
sqlite.prepare(`INSERT INTO reader_profiles (visitor_key, display_name, photo_key, created_at, updated_at) VALUES ('reader-a','А','',?,?),('reader-b','Б','',?,?),('reader-c','В','',?,?)`).run(now, now, now, now, now, now);
sqlite.prepare(`INSERT INTO reader_monthly_stats (visitor_key, month_key, xp, completed_chapters, completed_books, unique_reading_days, reached_xp_at, updated_at) VALUES ('reader-a','2026-09',50,10,1,3,?,?),('reader-b','2026-09',50,9,2,4,?,?),('reader-c','2026-09',500,50,8,8,?,?)`).run(now, now, now, now, now, now);

const sources = [
  '../app/api/rankings/route.js',
  '../app/api/reader-levels/route.js',
  '../app/api/readers/[publicId]/route.js',
];
let prepared = 0;
let publicRankingSql = '';
for (const relative of sources) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  for (const match of source.matchAll(/db\.prepare\(\s*`([\s\S]*?)`\s*\)/g)) {
    const sql = match[1];
    if (sql.includes('${')) continue;
    sqlite.prepare(sql);
    prepared += 1;
    if (sql.includes('WITH previous AS')) publicRankingSql = sql;
  }
}

assert.ok(prepared >= 15, 'all static ranking/profile queries compile against the migrated schema');
assert.ok(publicRankingSql, 'public monthly ranking query was found');
const ranked = sqlite.prepare(publicRankingSql).all('2026-08', '2026-09');
assert.deepEqual(ranked.map((row) => row.public_id), ['publicreader000000002', 'publicreader000000001'], 'monthly ties use books, reading days and chapters, while hidden readers stay out');
console.log(`Ranking SQL: ${prepared} queries checked.`);
