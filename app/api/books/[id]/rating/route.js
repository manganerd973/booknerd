import { hasReaderAccess } from '../../../../../lib/reader-access.js';
import { ensureDb } from '../../../../../lib/runtime.js';

const voterPattern = /^[a-zA-Z0-9-]{20,80}$/;

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

async function ratingSummary(db, bookId, voterKey = '') {
  const summary = await db.prepare(
    `SELECT COUNT(*) AS rating_count, AVG(rating) AS average_rating
     FROM book_ratings WHERE book_id = ?`
  ).bind(bookId).first();
  const own = voterPattern.test(voterKey)
    ? await db.prepare(`SELECT rating FROM book_ratings WHERE book_id = ? AND voter_key = ? LIMIT 1`).bind(bookId, voterKey).first()
    : null;
  return {
    average: Number(Number(summary?.average_rating || 0).toFixed(1)),
    count: Number(summary?.rating_count || 0),
    userRating: Number(own?.rating || 0),
  };
}

export async function GET(request, { params }) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const voterKey = String(new URL(request.url).searchParams.get('voterKey') || '').trim();
    const db = await ensureDb();
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? AND published = 1 LIMIT 1`).bind(id).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    return Response.json(await ratingSummary(db, id, voterKey));
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить оценку.' }, { status: 503 });
  }
}

export async function POST(request, { params }) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const payload = await request.json();
    const voterKey = String(payload.voterKey || '').trim();
    const rating = Number(payload.rating);
    if (!voterPattern.test(voterKey) || !Number.isInteger(rating) || rating < 0 || rating > 10) {
      return Response.json({ error: 'Выберите оценку от 0 до 10.' }, { status: 400 });
    }
    const db = await ensureDb();
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? AND published = 1 LIMIT 1`).bind(id).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });

    if (rating === 0) {
      await db.prepare(`DELETE FROM book_ratings WHERE book_id = ? AND voter_key = ?`).bind(id, voterKey).run();
    } else {
      const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO book_ratings (book_id, voter_key, rating, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(book_id, voter_key) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at`
      ).bind(id, voterKey, rating, now, now).run();
    }
    return Response.json(await ratingSummary(db, id, voterKey));
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить оценку.' }, { status: 500 });
  }
}
