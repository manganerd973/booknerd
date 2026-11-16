import { ensureDb, getDb } from './runtime.js';

function mapPublicNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    authorName: row.author_name || 'Читатель BOOKNERD',
    quote: row.quote || '',
    note: row.note || '',
    bookId: row.book_id,
    bookTitle: row.book_title || '',
    bookSlug: row.book_slug || '',
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title || '',
    paragraphIndex: Number(row.paragraph_index || 0),
    page: Number(row.page || 0),
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at,
  };
}

function daySeed(day) {
  return [...String(day)].reduce((seed, character) => ((seed * 33) + character.charCodeAt(0)) >>> 0, 5381);
}

export async function getQuotePool() {
  if (!getDb()) return [];
  try {
    const db = await ensureDb();
    const baseQuery = `SELECT n.*, b.title AS book_title, b.slug AS book_slug, c.title AS chapter_title
      FROM reader_public_notes n
      JOIN books b ON b.id = n.book_id
      JOIN chapters c ON c.id = n.chapter_id
      WHERE n.status = 'approved' AND n.is_spoiler = 0 AND b.published = 1 AND c.status = 'published'`;
    const pinned = await db.prepare(`${baseQuery} AND n.is_pinned = 1 ORDER BY n.updated_at DESC LIMIT 1`).first();
    if (pinned) return [mapPublicNote(pinned)];

    const result = await db.prepare(`${baseQuery} ORDER BY n.approved_at ASC, n.id ASC LIMIT 500`).all();
    const notes = result.results || [];
    if (!notes.length) {
      const fallback = await db.prepare(`SELECT id, slug, title, quote_of_day FROM books WHERE published = 1 AND TRIM(quote_of_day) != '' ORDER BY updated_at DESC LIMIT 1`).first();
      return fallback ? [{
        id: `book-${fallback.id}`,
        authorName: 'Редакция BOOKNERD',
        quote: fallback.quote_of_day,
        note: '',
        bookId: fallback.id,
        bookTitle: fallback.title,
        bookSlug: fallback.slug,
        chapterId: '',
        chapterTitle: '',
        page: 0,
        isPinned: false,
      }] : [];
    }
    return notes.map(mapPublicNote);
  } catch {
    // A missing migration must not make the homepage unavailable.
    return [];
  }
}

export function getNextQuoteChangeAt(now = new Date()) {
  const interval = 2 * 60 * 1000;
  return new Date((Math.floor(now.getTime() / interval) + 1) * interval).toISOString();
}

export async function getQuoteOfDay() {
  const notes = await getQuotePool();
  if (!notes.length) return null;
  const day = new Date().toISOString().slice(0, 10);
  return notes[daySeed(day) % notes.length];
}
