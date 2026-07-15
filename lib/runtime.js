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
      ]);

      const columns = await db.prepare(`PRAGMA table_info(books)`).all();
      const names = new Set((columns.results || []).map((column) => column.name));
      if (!names.has('series_title')) {
        await db.prepare(`ALTER TABLE books ADD COLUMN series_title TEXT DEFAULT '' NOT NULL`).run();
      }
      if (!names.has('series_number')) {
        await db.prepare(`ALTER TABLE books ADD COLUMN series_number INTEGER`).run();
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
