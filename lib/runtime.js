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

async function addColumnIfMissing(db, table, knownColumns, column, definition) {
  if (knownColumns.has(column)) return;
  try {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  } catch (error) {
    // Several Worker instances can initialize the same D1 database at once.
    // If another instance added the column after our PRAGMA check, that is success.
    if (!/duplicate column name/i.test(String(error?.message || error))) throw error;
  }
  knownColumns.add(column);
}

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
        series_reading_order TEXT DEFAULT '[]' NOT NULL,
        release_days TEXT DEFAULT '[]' NOT NULL,
        author TEXT NOT NULL,
        dedication TEXT DEFAULT '' NOT NULL,
        trigger_warnings TEXT DEFAULT '[]' NOT NULL,
        has_hot_scenes INTEGER DEFAULT 0 NOT NULL,
        hot_scene_chapters TEXT DEFAULT '' NOT NULL,
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
        point_of_view TEXT DEFAULT '' NOT NULL,
        body TEXT DEFAULT '' NOT NULL,
        body_rich TEXT DEFAULT '' NOT NULL,
        footnotes TEXT DEFAULT '[]' NOT NULL,
        heat_level INTEGER DEFAULT 0 NOT NULL,
        heat_pages TEXT DEFAULT '' NOT NULL,
        team_note TEXT DEFAULT '' NOT NULL,
        drive_url TEXT DEFAULT '' NOT NULL,
        status TEXT DEFAULT 'draft' NOT NULL,
        workflow_status TEXT DEFAULT 'draft' NOT NULL,
        scheduled_at TEXT,
        last_edited_by TEXT DEFAULT '' NOT NULL,
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
        parent_id TEXT,
        visitor_key TEXT DEFAULT '' NOT NULL,
        author_name TEXT NOT NULL,
        body TEXT NOT NULL,
        is_spoiler INTEGER DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'approved' NOT NULL,
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
        db.prepare(`CREATE TABLE IF NOT EXISTS book_ratings (
        book_id TEXT NOT NULL,
        voter_key TEXT NOT NULL,
        rating INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (book_id, voter_key),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS book_ratings_book_rating_idx ON book_ratings (book_id, rating)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS book_reviews (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        voter_key TEXT NOT NULL,
        author_name TEXT NOT NULL,
        body TEXT NOT NULL,
        rating INTEGER NOT NULL,
        status TEXT DEFAULT 'approved' NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS book_reviews_book_voter_unique ON book_reviews (book_id, voter_key)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS book_reviews_book_status_created_idx ON book_reviews (book_id, status, created_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS reader_presence (
        visitor_key TEXT PRIMARY KEY NOT NULL,
        book_id TEXT DEFAULT '' NOT NULL,
        chapter_id TEXT DEFAULT '' NOT NULL,
        updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS reader_presence_updated_idx ON reader_presence (updated_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS site_installs (
        visitor_key TEXT PRIMARY KEY NOT NULL,
        platform TEXT DEFAULT 'unknown' NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY NOT NULL,
        event_type TEXT NOT NULL,
        visitor_key TEXT NOT NULL,
        path TEXT DEFAULT '' NOT NULL,
        created_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS analytics_events_type_created_idx ON analytics_events (event_type, created_at)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS analytics_events_type_visitor_idx ON analytics_events (event_type, visitor_key)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS reader_library (
        visitor_key TEXT NOT NULL,
        book_id TEXT NOT NULL,
        status TEXT DEFAULT 'saved' NOT NULL,
        last_chapter_id TEXT,
        last_page INTEGER DEFAULT 0 NOT NULL,
        progress INTEGER DEFAULT 0 NOT NULL,
        reading_seconds INTEGER DEFAULT 0 NOT NULL,
        last_opened_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (visitor_key, book_id),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (last_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS reader_library_visitor_updated_idx ON reader_library (visitor_key, updated_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY NOT NULL,
        visitor_key TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS push_subscriptions_visitor_idx ON push_subscriptions (visitor_key)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS vapid_config (
        id TEXT PRIMARY KEY NOT NULL,
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL,
        created_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS push_announcements (
        chapter_id TEXT PRIMARY KEY NOT NULL,
        sent_at TEXT NOT NULL,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS notification_preferences (
        visitor_key TEXT NOT NULL,
        book_key TEXT NOT NULL,
        new_chapter INTEGER DEFAULT 1 NOT NULL,
        translation_complete INTEGER DEFAULT 0 NOT NULL,
        author_book INTEGER DEFAULT 0 NOT NULL,
        comment_reply INTEGER DEFAULT 0 NOT NULL,
        team_news INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (visitor_key, book_key)
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS notification_preferences_book_idx ON notification_preferences (book_key, new_chapter)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS reader_error_reports (
        id TEXT PRIMARY KEY NOT NULL,
        visitor_key TEXT NOT NULL,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        category TEXT NOT NULL,
        selected_text TEXT NOT NULL,
        paragraph_index INTEGER DEFAULT 0 NOT NULL,
        page INTEGER DEFAULT 0 NOT NULL,
        details TEXT DEFAULT '' NOT NULL,
        status TEXT DEFAULT 'new' NOT NULL,
        resolved_by TEXT DEFAULT '' NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS reader_error_reports_status_created_idx ON reader_error_reports (status, created_at)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS reader_error_reports_chapter_idx ON reader_error_reports (chapter_id, paragraph_index)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS book_glossary (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL,
        category TEXT DEFAULT 'character' NOT NULL,
        name TEXT NOT NULL,
        pronunciation TEXT DEFAULT '' NOT NULL,
        description TEXT DEFAULT '' NOT NULL,
        connections TEXT DEFAULT '' NOT NULL,
        reveal_after_chapter INTEGER DEFAULT 0 NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS book_glossary_book_reveal_idx ON book_glossary (book_id, reveal_after_chapter, sort_order)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS reader_bookmarks (
        id TEXT PRIMARY KEY NOT NULL,
        visitor_key TEXT NOT NULL,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        category TEXT DEFAULT 'later' NOT NULL,
        quote TEXT DEFAULT '' NOT NULL,
        paragraph_index INTEGER DEFAULT 0 NOT NULL,
        page INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS reader_bookmarks_visitor_book_idx ON reader_bookmarks (visitor_key, book_id, created_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS chapter_versions (
        id TEXT PRIMARY KEY NOT NULL,
        chapter_id TEXT NOT NULL,
        title TEXT NOT NULL,
        point_of_view TEXT DEFAULT '' NOT NULL,
        body TEXT DEFAULT '' NOT NULL,
        body_rich TEXT DEFAULT '' NOT NULL,
        footnotes TEXT DEFAULT '[]' NOT NULL,
        team_note TEXT DEFAULT '' NOT NULL,
        workflow_status TEXT DEFAULT 'draft' NOT NULL,
        scheduled_at TEXT,
        saved_by TEXT DEFAULT '' NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS chapter_versions_chapter_created_idx ON chapter_versions (chapter_id, created_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS chapter_audit (
        id TEXT PRIMARY KEY NOT NULL,
        chapter_id TEXT NOT NULL,
        action TEXT NOT NULL,
        from_status TEXT DEFAULT '' NOT NULL,
        to_status TEXT DEFAULT '' NOT NULL,
        editor_email TEXT DEFAULT '' NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS chapter_audit_chapter_created_idx ON chapter_audit (chapter_id, created_at)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS reading_sessions (
        visitor_key TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        reading_date TEXT NOT NULL,
        seconds INTEGER DEFAULT 0 NOT NULL,
        max_progress INTEGER DEFAULT 0 NOT NULL,
        completed INTEGER DEFAULT 0 NOT NULL,
        notification_return INTEGER DEFAULT 0 NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (visitor_key, chapter_id, reading_date),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`),
        db.prepare(`CREATE INDEX IF NOT EXISTS reading_sessions_book_chapter_idx ON reading_sessions (book_id, chapter_id)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS reading_sessions_visitor_date_idx ON reading_sessions (visitor_key, reading_date)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS translation_candidates (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        author TEXT DEFAULT '' NOT NULL,
        suggested_by TEXT DEFAULT '' NOT NULL,
        status TEXT DEFAULT 'suggested' NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS translation_votes (
        candidate_id TEXT NOT NULL,
        visitor_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (candidate_id, visitor_key),
        FOREIGN KEY (candidate_id) REFERENCES translation_candidates(id) ON DELETE CASCADE
        )`),
      ]);

      const columns = await db.prepare(`PRAGMA table_info(books)`).all();
      const names = new Set((columns.results || []).map((column) => column.name));
      await addColumnIfMissing(db, 'books', names, 'series_title', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'series_number', `INTEGER`);
      await addColumnIfMissing(db, 'books', names, 'series_reading_order', `TEXT DEFAULT '[]' NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'release_days', `TEXT DEFAULT '[]' NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'tropes', `TEXT DEFAULT '[]' NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'drive_url', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'dedication', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'trigger_warnings', `TEXT DEFAULT '[]' NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'has_hot_scenes', `INTEGER DEFAULT 0 NOT NULL`);
      await addColumnIfMissing(db, 'books', names, 'hot_scene_chapters', `TEXT DEFAULT '' NOT NULL`);

      const chapterColumns = await db.prepare(`PRAGMA table_info(chapters)`).all();
      const chapterNames = new Set((chapterColumns.results || []).map((column) => column.name));
      await addColumnIfMissing(db, 'chapters', chapterNames, 'drive_url', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'footnotes', `TEXT DEFAULT '[]' NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'body_rich', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'point_of_view', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'heat_level', `INTEGER DEFAULT 0 NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'heat_pages', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'team_note', `TEXT DEFAULT '' NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'workflow_status', `TEXT DEFAULT 'draft' NOT NULL`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'scheduled_at', `TEXT`);
      await addColumnIfMissing(db, 'chapters', chapterNames, 'last_edited_by', `TEXT DEFAULT '' NOT NULL`);

      const libraryColumns = await db.prepare(`PRAGMA table_info(reader_library)`).all();
      const libraryNames = new Set((libraryColumns.results || []).map((column) => column.name));
      await addColumnIfMissing(db, 'reader_library', libraryNames, 'last_page', `INTEGER DEFAULT 0 NOT NULL`);
      await addColumnIfMissing(db, 'reader_library', libraryNames, 'reading_seconds', `INTEGER DEFAULT 0 NOT NULL`);
      await addColumnIfMissing(db, 'reader_library', libraryNames, 'last_opened_at', `TEXT`);

      const commentColumns = await db.prepare(`PRAGMA table_info(comments)`).all();
      const commentNames = new Set((commentColumns.results || []).map((column) => column.name));
      await addColumnIfMissing(db, 'comments', commentNames, 'parent_id', `TEXT`);
      await addColumnIfMissing(db, 'comments', commentNames, 'visitor_key', `TEXT DEFAULT '' NOT NULL`);
      if (!commentNames.has('is_spoiler')) {
        await addColumnIfMissing(db, 'comments', commentNames, 'is_spoiler', `INTEGER DEFAULT 0 NOT NULL`);
        await db.prepare(`UPDATE comments SET status = 'approved' WHERE status = 'pending'`).run();
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
