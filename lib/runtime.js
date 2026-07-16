import { env } from 'cloudflare:workers';

export function getDb() {
  return env.DB || null;
}

export function requireDb() {
  const db = getDb();
  if (!db) throw new Error('Хранилище книг временно недоступно.');
  return db;
}

let schemaPromise = null;

export async function ensureDb() {
  const db = requireDb();
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        original_title TEXT DEFAULT '' NOT NULL,
        series_title TEXT DEFAULT '' NOT NULL,
        series_number INTEGER,
        author TEXT NOT NULL,
        synopsis TEXT DEFAULT '' NOT NULL,
        genres TEXT DEFAULT '[]' NOT NULL,
        tropes TEXT DEFAULT '[]' NOT NULL,
        drive_url TEXT DEFAULT '' NOT NULL,
        status TEXT DEFAULT 'Черновик' NOT NULL,
        progress INTEGER DEFAULT 0 NOT NULL,
        cover_key TEXT,
        published INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS books_slug_unique ON books (slug)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT DEFAULT '' NOT NULL,
        drive_url TEXT DEFAULT '' NOT NULL,
        status TEXT DEFAULT 'draft' NOT NULL,
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS chapters_book_number_unique ON chapters (book_id, chapter_number)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS admin_users (
        email TEXT PRIMARY KEY NOT NULL,
        role TEXT DEFAULT 'editor' NOT NULL,
        created_at TEXT NOT NULL,
        invited_by TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS book_covers (
        key TEXT PRIMARY KEY NOT NULL,
        content_type TEXT NOT NULL,
        data BLOB NOT NULL,
        created_at TEXT NOT NULL,
        uploaded_by TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS book_artworks (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        image_key TEXT NOT NULL,
        caption TEXT DEFAULT '' NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS book_artworks_book_sort_idx ON book_artworks (book_id, sort_order, created_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        chapter_id TEXT,
        author_name TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS comments_book_status_created_idx ON comments (book_id, status, created_at)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS comments_chapter_status_created_idx ON comments (chapter_id, status, created_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS comment_votes (
        comment_id TEXT NOT NULL,
        voter_key TEXT NOT NULL,
        value INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (comment_id, voter_key),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS comment_votes_comment_value_idx ON comment_votes (comment_id, value)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS comment_reports (
        comment_id TEXT NOT NULL,
        voter_key TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT DEFAULT '' NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (comment_id, voter_key),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS comment_reports_comment_created_idx ON comment_reports (comment_id, created_at)`),
      ]);

      const columns = await db.prepare(`PRAGMA table_info(books)`).all();
      const names = new Set((columns.results || []).map((column) => column.name));
      if (!names.has('series_title')) {
        await db.prepare(`ALTER TABLE books ADD COLUMN series_title TEXT DEFAULT '' NOT NULL`).run();
      }
      if (!names.has('series_number')) {
        await db.prepare(`ALTER TABLE books ADD COLUMN series_number INTEGER`).run();
      }
      if (!names.has('tropes')) {
        await db.prepare(`ALTER TABLE books ADD COLUMN tropes TEXT DEFAULT '[]' NOT NULL`).run();
      }
      if (!names.has('drive_url')) {
        await db.prepare(`ALTER TABLE books ADD COLUMN drive_url TEXT DEFAULT '' NOT NULL`).run();
      }

      const chapterColumns = await db.prepare(`PRAGMA table_info(chapters)`).all();
      const chapterNames = new Set((chapterColumns.results || []).map((column) => column.name));
      if (!chapterNames.has('drive_url')) {
        await db.prepare(`ALTER TABLE chapters ADD COLUMN drive_url TEXT DEFAULT '' NOT NULL`).run();
      }
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
  return db;
}

export function getOwnerEmail() {
  const localOwner = typeof process !== 'undefined' ? process.env?.BOOKNERD_OWNER_EMAIL : '';
  return String(env.BOOKNERD_OWNER_EMAIL || localOwner || '')
    .trim()
    .toLowerCase();
}

export function getOwnerPassword() {
  const localPassword = typeof process !== 'undefined' ? process.env?.BOOKNERD_OWNER_PASSWORD : '';
  return String(env.BOOKNERD_OWNER_PASSWORD || localPassword || '').trim();
}

export function getTeamPassword() {
  const localPassword = typeof process !== 'undefined' ? process.env?.BOOKNERD_TEAM_PASSWORD : '';
  return String(env.BOOKNERD_TEAM_PASSWORD || localPassword || '').trim();
}
