import { ensureDb } from './runtime.js';

const EDITORIAL_QUOTES = [
  'Истории, которые мы хотели прочитать сами.',
  'Иногда новая глава — лучший способ начать сначала.',
  'Самые любимые книжные миры всегда ждут возвращения.',
  'Книга становится нашей, когда в ней остаются наши мысли.',
  'Хорошая история заканчивается, но ещё долго не отпускает.',
  'Есть главы, к которым возвращаются не только ради сюжета.',
  'Чтение — маленькое путешествие, которое помещается в ладони.',
];

export const QUOTE_ROTATION_INTERVAL_MS = 2 * 60 * 1000;

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
    source: 'reader',
    createdAt: row.created_at,
  };
}

function rotationSlot(now = Date.now()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  return Math.floor((Number.isFinite(timestamp) ? timestamp : Date.now()) / QUOTE_ROTATION_INTERVAL_MS);
}

function defaultQuoteForSlot(slot) {
  return {
    id: `booknerd-editorial-${slot}`,
    authorName: 'Редакция BOOKNERD',
    quote: EDITORIAL_QUOTES[slot % EDITORIAL_QUOTES.length],
    note: '',
    bookId: '',
    bookTitle: 'Переводы BOOKNERD',
    bookSlug: '',
    chapterId: '',
    chapterTitle: '',
    page: 0,
    isPinned: false,
    source: 'editorial',
  };
}

function uniqueQuotes(candidates) {
  return candidates.filter((candidate, index, list) => (
    list.findIndex((item) => item.quote.trim().toLocaleLowerCase('ru-RU') === candidate.quote.trim().toLocaleLowerCase('ru-RU')) === index
  ));
}

export function getNextQuoteChangeAt(now = Date.now()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  return new Date((rotationSlot(safeTimestamp) + 1) * QUOTE_ROTATION_INTERVAL_MS).toISOString();
}

export async function getQuoteOfDay(now = new Date()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const slot = rotationSlot(safeTimestamp);
  let db;
  const readerCandidates = [];
  const editorialCandidates = [];

  try {
    db = await ensureDb();
  } catch {
    return defaultQuoteForSlot(slot);
  }

  try {
    const baseQuery = `SELECT n.*, b.title AS book_title, b.slug AS book_slug, c.title AS chapter_title
      FROM reader_public_notes n
      JOIN books b ON b.id = n.book_id
      JOIN chapters c ON c.id = n.chapter_id
      WHERE n.status = 'approved' AND n.is_spoiler = 0 AND b.published = 1 AND c.status = 'published'`;
    const result = await db.prepare(`${baseQuery} ORDER BY n.is_pinned DESC, n.approved_at ASC, n.id ASC LIMIT 500`).all();
    readerCandidates.push(...(result.results || []).map(mapPublicNote).filter(Boolean));
  } catch {
    // Continue to the editorial fallback when an older database does not yet
    // contain the public reader-notes table.
  }

  try {
    const result = await db.prepare(
      `SELECT id, slug, title, quote_of_day
       FROM books
       WHERE published = 1 AND TRIM(quote_of_day) != ''
       ORDER BY id ASC
       LIMIT 500`
    ).all();
    (result.results || []).forEach((book) => {
      String(book.quote_of_day || '')
        .split(/\n+|\s*\|\|\s*/)
        .map((quote) => quote.trim())
        .filter(Boolean)
        .forEach((quote, index) => editorialCandidates.push({
          id: `book-${book.id}-${index}`,
          authorName: 'Редакция BOOKNERD',
          quote,
          note: '',
          bookId: book.id,
          bookTitle: book.title,
          bookSlug: book.slug,
          chapterId: '',
          chapterTitle: '',
          page: 0,
          isPinned: false,
          source: 'editorial',
        }));
    });
  } catch {
    // The homepage always keeps a useful editorial quote even during a schema
    // update or a temporary database failure.
  }

  const approvedReaderQuotes = uniqueQuotes(readerCandidates);
  if (approvedReaderQuotes.length) {
    return approvedReaderQuotes[slot % approvedReaderQuotes.length];
  }

  const uniqueCandidates = uniqueQuotes(editorialCandidates);
  if (uniqueCandidates.length < 2) {
    uniqueCandidates.push(...EDITORIAL_QUOTES.map((quote, index) => ({
      ...defaultQuoteForSlot(slot),
      id: `booknerd-editorial-${index}`,
      quote,
    })));
  }

  const quotePool = uniqueQuotes(uniqueCandidates);
  return quotePool[slot % quotePool.length] || defaultQuoteForSlot(slot);
}
