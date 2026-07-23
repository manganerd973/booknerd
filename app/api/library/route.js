import { ensureDb } from '../../../lib/runtime.js';

const ALLOWED_STATUSES = new Set(['saved', 'reading', 'finished']);

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function normalizeProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

export async function GET(request) {
  try {
    const visitorKey = normalizeVisitorKey(new URL(request.url).searchParams.get('visitorKey'));
    if (!visitorKey) return Response.json({ items: [] });
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT visitor_key, book_id, status, last_chapter_id, progress, created_at, updated_at
       FROM reader_library WHERE visitor_key = ? ORDER BY updated_at DESC`
    ).bind(visitorKey).all();
    return Response.json({
      items: (result.results || []).map((row) => ({
        visitorKey: row.visitor_key,
        bookId: row.book_id,
        status: ALLOWED_STATUSES.has(row.status) ? row.status : 'saved',
        lastChapterId: row.last_chapter_id || null,
        progress: normalizeProgress(row.progress),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch {
    return Response.json({ items: [] });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const bookId = String(payload.bookId || '').trim().slice(0, 100);
    if (!visitorKey || !bookId) {
      return Response.json({ error: 'Не удалось определить читателя или книгу.' }, { status: 400 });
    }
    const db = await ensureDb();
    if (payload.action === 'remove') {
      await db.prepare(`DELETE FROM reader_library WHERE visitor_key = ? AND book_id = ?`).bind(visitorKey, bookId).run();
      return Response.json({ ok: true, item: null });
    }

    const status = ALLOWED_STATUSES.has(payload.status) ? payload.status : 'saved';
    const preserveFinished = payload.preserveFinished === true;
    const progress = status === 'finished' ? 100 : normalizeProgress(payload.progress);
    const requestedChapterId = String(payload.lastChapterId || '').trim().slice(0, 100);
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? AND published = 1 LIMIT 1`).bind(bookId).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    const chapter = requestedChapterId
      ? await db.prepare(`SELECT id FROM chapters WHERE id = ? AND book_id = ? LIMIT 1`).bind(requestedChapterId, bookId).first()
      : null;
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO reader_library
       (visitor_key, book_id, status, last_chapter_id, progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(visitor_key, book_id) DO UPDATE SET
       status = CASE
         WHEN ? = 1 AND reader_library.status = 'finished' AND excluded.status != 'finished' THEN reader_library.status
         ELSE excluded.status
       END,
       last_chapter_id = COALESCE(excluded.last_chapter_id, reader_library.last_chapter_id),
       progress = MAX(reader_library.progress, excluded.progress),
       updated_at = excluded.updated_at`
    ).bind(visitorKey, bookId, status, chapter?.id || null, progress, now, now, preserveFinished ? 1 : 0).run();

    const saved = await db.prepare(
      `SELECT status, last_chapter_id, progress, updated_at
       FROM reader_library WHERE visitor_key = ? AND book_id = ? LIMIT 1`
    ).bind(visitorKey, bookId).first();

    return Response.json({
      ok: true,
      item: {
        visitorKey,
        bookId,
        status: ALLOWED_STATUSES.has(saved?.status) ? saved.status : status,
        lastChapterId: saved?.last_chapter_id || null,
        progress: normalizeProgress(saved?.progress ?? progress),
        updatedAt: saved?.updated_at || now,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось обновить личную библиотеку.' }, { status: 500 });
  }
}
