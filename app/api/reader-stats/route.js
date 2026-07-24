import { ensureDb } from '../../../lib/runtime.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function parseList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function longestStreak(dates) {
  const unique = [...new Set(dates)].sort();
  let best = 0;
  let current = 0;
  let previous = null;
  for (const value of unique) {
    const day = new Date(`${value}T00:00:00Z`);
    if (previous && (day - previous) === 86400000) current += 1;
    else current = 1;
    best = Math.max(best, current);
    previous = day;
  }
  return best;
}

function mostFrequent(items, limit = 3) {
  const counts = new Map();
  for (const item of items.filter(Boolean)) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit).map(([name]) => name);
}

export async function GET(request) {
  try {
    const visitorKey = normalizeVisitorKey(new URL(request.url).searchParams.get('visitorKey'));
    if (!visitorKey) return Response.json({ stats: null });
    const db = await ensureDb();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [library, sessions, totals, month] = await Promise.all([
      db.prepare(
        `SELECT rl.status, b.genres, b.tropes
         FROM reader_library rl JOIN books b ON b.id = rl.book_id
         WHERE rl.visitor_key = ?`
      ).bind(visitorKey).all(),
      db.prepare(
        `SELECT reading_date FROM reading_sessions
         WHERE visitor_key = ? AND seconds > 0
         ORDER BY reading_date ASC`
      ).bind(visitorKey).all(),
      db.prepare(
        `SELECT
           COUNT(DISTINCT CASE WHEN completed = 1 THEN chapter_id END) AS chapters_read,
           COALESCE(SUM(seconds), 0) AS seconds
         FROM reading_sessions WHERE visitor_key = ?`
      ).bind(visitorKey).first(),
      db.prepare(
        `SELECT
           COUNT(DISTINCT chapter_id) AS chapters,
           COUNT(DISTINCT book_id) AS books,
           COALESCE(SUM(seconds), 0) AS seconds
         FROM reading_sessions
         WHERE visitor_key = ? AND updated_at >= ?`
      ).bind(visitorKey, monthStart.toISOString()).first(),
    ]);
    const libraryRows = library.results || [];
    const genres = libraryRows.flatMap((row) => parseList(row.genres));
    const tropes = libraryRows.flatMap((row) => parseList(row.tropes));
    const booksRead = libraryRows.filter((row) => row.status === 'finished').length;
    return Response.json({
      stats: {
        booksRead,
        chaptersRead: Number(totals?.chapters_read || 0),
        readingSeconds: Number(totals?.seconds || 0),
        favoriteGenres: mostFrequent(genres),
        favoriteTropes: mostFrequent(tropes),
        longestStreak: longestStreak((sessions.results || []).map((row) => row.reading_date)),
        wrapped: {
          month: new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date()),
          books: Number(month?.books || 0),
          chapters: Number(month?.chapters || 0),
          seconds: Number(month?.seconds || 0),
        },
      },
    });
  } catch {
    return Response.json({ stats: null });
  }
}
