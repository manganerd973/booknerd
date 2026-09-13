import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { DEFAULT_READER_LEVEL_CONFIG, levelForXp, rankForLevel, xpForLevel } from '../lib/reader-level-config.js';
import { finalizeReaderMonth, monthKey, refreshReaderLevel } from '../lib/reader-levels.js';
import { verifyChapterCompletion } from '../lib/reading-completion.js';

class Statement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.statement.get(...this.values) || null; }
  async all() { return { results: this.statement.all(...this.values) }; }
  async run() { const result = this.statement.run(...this.values); return { meta: { changes: result.changes } }; }
}

function adapter(sqlite) {
  return {
    prepare(sql) { return new Statement(sqlite.prepare(sql)); },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => statement.statement.run(...statement.values));
        sqlite.exec('COMMIT');
        return results.map((result) => ({ meta: { changes: result.changes } }));
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  CREATE TABLE books (id TEXT PRIMARY KEY, status TEXT, series_title TEXT, genres TEXT, tropes TEXT, published INTEGER);
  CREATE TABLE chapters (id TEXT PRIMARY KEY, book_id TEXT, status TEXT);
  CREATE TABLE reading_sessions (visitor_key TEXT, chapter_id TEXT, book_id TEXT, reading_date TEXT, seconds INTEGER DEFAULT 0, max_progress INTEGER DEFAULT 0, completed INTEGER DEFAULT 0, notification_return INTEGER DEFAULT 0, started_at TEXT, updated_at TEXT, PRIMARY KEY(visitor_key, chapter_id, reading_date));
  CREATE TABLE reader_library (visitor_key TEXT, book_id TEXT, status TEXT, progress INTEGER, PRIMARY KEY(visitor_key, book_id));
  CREATE TABLE book_reviews (id TEXT PRIMARY KEY, book_id TEXT, voter_key TEXT, body TEXT, status TEXT, created_at TEXT);
  CREATE UNIQUE INDEX book_reviews_book_voter_unique ON book_reviews(book_id, voter_key);
  CREATE TABLE reader_error_reports (id TEXT PRIMARY KEY, visitor_key TEXT, chapter_id TEXT, paragraph_index INTEGER, selected_text TEXT, status TEXT, updated_at TEXT);
  CREATE TABLE reader_profiles (visitor_key TEXT PRIMARY KEY, display_name TEXT, favorite_quotes TEXT DEFAULT '[]', created_at TEXT, updated_at TEXT);
  CREATE TABLE reader_public_notes (id TEXT PRIMARY KEY, visitor_key TEXT, status TEXT, created_at TEXT);
  CREATE TABLE reader_notifications (id TEXT PRIMARY KEY, visitor_key TEXT, event_key TEXT, type TEXT, book_id TEXT, chapter_id TEXT, comment_id TEXT, actor_name TEXT, title TEXT, body TEXT, url TEXT, read_at TEXT, hidden_at TEXT, created_at TEXT);
`);

const migration = readFileSync(new URL('../.openai/drizzle/0025_reader_levels_and_rankings.sql', import.meta.url), 'utf8');
sqlite.exec(migration);
sqlite.exec(migration);

assert.equal(xpForLevel(1), 0);
assert.equal(xpForLevel(2), 50);
assert.equal(xpForLevel(3), 120);
assert.equal(xpForLevel(4), 210);
assert.equal(xpForLevel(5), 320);
assert.equal(levelForXp(119), 2);
assert.equal(levelForXp(120), 3);
assert.equal(rankForLevel(24).name, 'Хранитель страниц');
assert.deepEqual(verifyChapterCompletion({ requested: true, progress: 100, elapsedSeconds: 1, previousProgress: 100 }), { accepted: false, newlyCompleted: false }, 'instant jump is rejected');
assert.deepEqual(verifyChapterCompletion({ requested: true, progress: 100, elapsedSeconds: 12, previousProgress: 30 }), { accepted: true, newlyCompleted: true }, 'natural progress is accepted');
assert.deepEqual(verifyChapterCompletion({ previouslyCompleted: true, requested: true, progress: 100 }), { accepted: true, newlyCompleted: false }, 'repeat completion never earns again');
assert.deepEqual(verifyChapterCompletion({ requested: true, progress: 100, elapsedSeconds: 30, offlineEvidence: true }), { accepted: true, newlyCompleted: true }, 'offline evidence can be synchronized once');

const visitor = 'reader-1234567890';
const now = new Date().toISOString();
sqlite.prepare(`INSERT INTO books VALUES ('book-1','Завершено','Серия A','["Фэнтези"]','["найденная семья"]',1)`).run();
sqlite.prepare(`INSERT INTO chapters VALUES ('chapter-1','book-1','published'),('chapter-2','book-1','published')`).run();
sqlite.prepare(`INSERT INTO reader_profiles VALUES (?, 'Лейла', '["Первая цитата"]', '2025-01-01T00:00:00.000Z', ?)`).run(visitor, now);
sqlite.prepare(`INSERT INTO reading_sessions VALUES (?, 'chapter-1','book-1','2026-09-07',120,100,1,0,?,?), (?, 'chapter-1','book-1','2026-09-08',60,100,1,0,?,?), (?, 'chapter-2','book-1','2026-09-09',120,100,1,0,?,?)`).run(visitor, now, now, visitor, now, now, visitor, now, now);
sqlite.prepare(`INSERT INTO book_reviews VALUES ('review-1','book-1',?, 'Это содержательный отзыв о полностью прочитанной книге BOOKNERD.', 'approved', ?)`).run(visitor, now);
sqlite.prepare(`INSERT INTO reader_error_reports VALUES ('error-1',?,'chapter-1',2,'опечатка','resolved',?), ('error-2',?,'chapter-1',2,'опечатка','resolved',?)`).run(visitor, now, visitor, now);

const db = adapter(sqlite);
const first = await refreshReaderLevel({ db, visitorKey: visitor, suppressNotifications: true });
const second = await refreshReaderLevel({ db, visitorKey: visitor, suppressNotifications: true });
assert.equal(first.totalXp, 150, 'XP is calculated from unique completions and deduplicated errors');
assert.equal(second.totalXp, first.totalXp, 'recalculation is idempotent');
assert.equal(sqlite.prepare(`SELECT COUNT(*) AS total FROM reader_level_stats`).get().total, 1);
assert.equal(sqlite.prepare(`SELECT COUNT(*) AS total FROM reader_achievements`).get().total, sqlite.prepare(`SELECT COUNT(DISTINCT achievement_key) AS total FROM reader_achievements`).get().total);
assert.equal(sqlite.prepare(`SELECT completed_chapters FROM reader_level_stats WHERE visitor_key = ?`).get(visitor).completed_chapters, 2, 'same chapter is counted once');
assert.equal(sqlite.prepare(`SELECT completed_books FROM reader_level_stats WHERE visitor_key = ?`).get(visitor).completed_books, 1, 'completed book is counted once');
const finalized = await finalizeReaderMonth(db, monthKey());
const finalizedAgain = await finalizeReaderMonth(db, monthKey());
assert.ok(finalized.awards >= 1, 'monthly awards are generated');
assert.equal(finalizedAgain.alreadyFinalized, true, 'month finalization is idempotent');

sqlite.prepare(`DELETE FROM book_reviews WHERE id = 'review-1'`).run();
const afterDelete = await refreshReaderLevel({ db, visitorKey: visitor, suppressNotifications: true });
assert.equal(afterDelete.totalXp, 130, 'deleted review no longer contributes review XP');
sqlite.prepare(`DELETE FROM reader_error_reports WHERE visitor_key = ?`).run(visitor);
sqlite.prepare(`DELETE FROM reading_sessions WHERE visitor_key = ? AND chapter_id = 'chapter-1' AND reading_date = '2026-09-08'`).run(visitor);
sqlite.prepare(`UPDATE reading_sessions SET reading_date = '2026-09-07' WHERE visitor_key = ? AND chapter_id = 'chapter-2'`).run(visitor);
const afterEvidenceRemoval = await refreshReaderLevel({ db, visitorKey: visitor, suppressNotifications: true });
assert.equal(afterEvidenceRemoval.level, 3, 'a previously earned level never decreases');
assert.equal(afterEvidenceRemoval.totalXp, 120, 'XP does not fall below the threshold of a previously earned level');
sqlite.prepare(`UPDATE reader_level_stats SET public_visible = 0 WHERE visitor_key = ?`).run(visitor);
assert.equal(sqlite.prepare(`SELECT COUNT(*) AS total FROM reader_level_stats WHERE public_visible = 1`).get().total, 0, 'hidden profile is excluded from public selection');

console.log('Reader levels: 24 checks passed.');
