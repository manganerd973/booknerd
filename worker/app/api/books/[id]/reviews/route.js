import { hasReaderAccess } from '../../../../../lib/reader-access.js';
import { ensureDb } from '../../../../../lib/runtime.js';

const voterPattern = /^[a-zA-Z0-9-]{20,80}$/;

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    rating: Number(row.rating || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    const result = await db.prepare(
      `SELECT id, author_name, body, rating, created_at, updated_at
       FROM book_reviews WHERE book_id = ? AND status = 'approved'
       ORDER BY created_at DESC LIMIT 100`
    ).bind(id).all();
    const own = voterPattern.test(voterKey)
      ? await db.prepare(
        `SELECT id, author_name, body, rating, created_at, updated_at
         FROM book_reviews WHERE book_id = ? AND voter_key = ? LIMIT 1`
      ).bind(id, voterKey).first()
      : null;
    return Response.json({ reviews: (result.results || []).map(mapReview), currentReview: mapReview(own) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить отзывы.' }, { status: 503 });
  }
}

export async function POST(request, { params }) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const { id: bookId } = await params;
    const payload = await request.json();
    const voterKey = String(payload.voterKey || '').trim();
    const authorName = String(payload.authorName || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const body = String(payload.body || '').trim().slice(0, 3000);
    const rating = Number(payload.rating);
    if (payload.website) return Response.json({ ok: true }, { status: 201 });
    if (!voterPattern.test(voterKey) || authorName.length < 2 || body.length < 10 || !Number.isInteger(rating) || rating < 1 || rating > 10) {
      return Response.json({ error: 'Выберите оценку от 1 до 10 и напишите отзыв.' }, { status: 400 });
    }

    const db = await ensureDb();
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? AND published = 1 LIMIT 1`).bind(bookId).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    const now = new Date().toISOString();
    const reviewId = crypto.randomUUID();
    await db.batch([
      db.prepare(
        `INSERT INTO book_reviews (id, book_id, voter_key, author_name, body, rating, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)
         ON CONFLICT(book_id, voter_key) DO UPDATE SET
           author_name = excluded.author_name, body = excluded.body, rating = excluded.rating,
           status = 'approved', updated_at = excluded.updated_at`
      ).bind(reviewId, bookId, voterKey, authorName, body, rating, now, now),
      db.prepare(
        `INSERT INTO book_ratings (book_id, voter_key, rating, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(book_id, voter_key) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at`
      ).bind(bookId, voterKey, rating, now, now),
    ]);
    const saved = await db.prepare(
      `SELECT id, author_name, body, rating, created_at, updated_at
       FROM book_reviews WHERE book_id = ? AND voter_key = ? LIMIT 1`
    ).bind(bookId, voterKey).first();
    return Response.json({ ok: true, review: mapReview(saved) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось опубликовать отзыв.' }, { status: 500 });
  }
}
