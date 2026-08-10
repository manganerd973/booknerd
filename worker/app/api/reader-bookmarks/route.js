import { ensureDb } from '../../../lib/runtime.js';

const CATEGORIES = new Set(['favorite', 'later', 'important', 'funny']);

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const visitorKey = normalizeVisitorKey(url.searchParams.get('visitorKey'));
    const bookId = String(url.searchParams.get('bookId') || '').trim().slice(0, 100);
    if (!visitorKey || !bookId) return Response.json({ bookmarks: [] });
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT rb.*, c.chapter_number, c.title AS chapter_title
       FROM reader_bookmarks rb
       JOIN chapters c ON c.id = rb.chapter_id
       WHERE rb.visitor_key = ? AND rb.book_id = ?
       ORDER BY rb.created_at DESC`
    ).bind(visitorKey, bookId).all();
    return Response.json({
      bookmarks: (result.results || []).map((row) => ({
        id: row.id,
        bookId: row.book_id,
        chapterId: row.chapter_id,
        category: CATEGORIES.has(row.category) ? row.category : 'later',
        quote: row.quote || '',
        paragraphIndex: Number(row.paragraph_index || 0),
        page: Number(row.page || 0),
        chapterNumber: Number(row.chapter_number || 0),
        chapterTitle: row.chapter_title || '',
        createdAt: row.created_at,
      })),
    });
  } catch {
    return Response.json({ bookmarks: [] });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const bookId = String(payload.bookId || '').trim().slice(0, 100);
    const chapterId = String(payload.chapterId || '').trim().slice(0, 100);
    const category = CATEGORIES.has(payload.category) ? payload.category : 'later';
    const quote = String(payload.quote || '').trim().slice(0, 1000);
    const paragraphIndex = Math.max(0, Math.floor(Number(payload.paragraphIndex || 0)));
    const page = Math.max(0, Math.floor(Number(payload.page || 0)));
    if (!visitorKey || !bookId || !chapterId) {
      return Response.json({ error: 'Не удалось определить место закладки.' }, { status: 400 });
    }
    const db = await ensureDb();
    const chapter = await db.prepare(`SELECT id FROM chapters WHERE id = ? AND book_id = ? LIMIT 1`).bind(chapterId, bookId).first();
    if (!chapter) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.prepare(
      `INSERT INTO reader_bookmarks
       (id, visitor_key, book_id, chapter_id, category, quote, paragraph_index, page, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, visitorKey, bookId, chapterId, category, quote, paragraphIndex, page, createdAt).run();
    return Response.json({ bookmark: { id, bookId, chapterId, category, quote, paragraphIndex, page, createdAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить закладку.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const visitorKey = normalizeVisitorKey(url.searchParams.get('visitorKey'));
    const id = String(url.searchParams.get('id') || '').trim().slice(0, 100);
    if (!visitorKey || !id) return Response.json({ error: 'Закладка не указана.' }, { status: 400 });
    const db = await ensureDb();
    await db.prepare(`DELETE FROM reader_bookmarks WHERE id = ? AND visitor_key = ?`).bind(id, visitorKey).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить закладку.' }, { status: 500 });
  }
}
