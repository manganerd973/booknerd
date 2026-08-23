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

function calendarDayNumber(day) {
  const [year, month, date] = String(day).split('-').map(Number);
  return Math.floor(Date.UTC(year || 1970, Math.max(0, (month || 1) - 1), date || 1) / 86400000);
}

function defaultQuoteForDay(day) {
  return {
    id: `booknerd-editorial-${day}`,
    authorName: 'Редакция BOOKNERD',
    quote: EDITORIAL_QUOTES[calendarDayNumber(day) % EDITORIAL_QUOTES.length],
    note: '',
    bookId: '',
    bookTitle: 'Переводы BOOKNERD',
    bookSlug: '',
    chapterId: '',
    chapterTitle: '',
    page: 0,
    isPinned: false,
  };
}

function currentBooknerdDay() {
  // BOOKNERD is managed in Asia/Dushanbe (UTC+5), so the quote changes at the
  // editor's local midnight instead of five hours later at UTC midnight.
  return new Date(Date.now() + (5 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

export async function getQuoteOfDay() {
  const day = currentBooknerdDay();
  let db;
  const candidates = [];

  try {
    db = await ensureDb();
  } catch {
    return defaultQuoteForDay(day);
  }

  try {
    const baseQuery = `SELECT n.*, b.title AS book_title, b.slug AS book_slug, c.title AS chapter_title
      FROM reader_public_notes n
      JOIN books b ON b.id = n.book_id
      JOIN chapters c ON c.id = n.chapter_id
      WHERE n.status = 'approved' AND n.is_spoiler = 0 AND b.published = 1 AND c.status = 'published'`;
    const result = await db.prepare(`${baseQuery} ORDER BY n.is_pinned DESC, n.approved_at ASC, n.id ASC LIMIT 500`).all();
    candidates.push(...(result.results || []).map(mapPublicNote).filter(Boolean));
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
        .forEach((quote, index) => candidates.push({
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
        }));
    });
  } catch {
    // The homepage always keeps a useful editorial quote even during a schema
    // update or a temporary database failure.
  }

  const uniqueCandidates = candidates.filter((candidate, index, list) => (
    list.findIndex((item) => item.quote.trim().toLocaleLowerCase('ru-RU') === candidate.quote.trim().toLocaleLowerCase('ru-RU')) === index
  ));

  if (uniqueCandidates.length < 2) {
    uniqueCandidates.push(...EDITORIAL_QUOTES.map((quote, index) => ({
      ...defaultQuoteForDay(day),
      id: `booknerd-editorial-${index}`,
      quote,
    })));
  }

  const quotePool = uniqueCandidates.filter((candidate, index, list) => (
    list.findIndex((item) => item.quote.trim().toLocaleLowerCase('ru-RU') === candidate.quote.trim().toLocaleLowerCase('ru-RU')) === index
  ));
  return quotePool[calendarDayNumber(day) % quotePool.length] || defaultQuoteForDay(day);
}
