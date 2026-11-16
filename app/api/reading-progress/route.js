import { ensureDb } from '../../../lib/runtime.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const bookId = String(payload.bookId || '').trim().slice(0, 100);
    const chapterId = String(payload.chapterId || '').trim().slice(0, 100);
    if (!visitorKey || !bookId || !chapterId) {
      return Response.json({ error: 'Не удалось сохранить прогресс чтения.' }, { status: 400 });
    }
    const seconds = Math.max(0, Math.min(120, Math.floor(Number(payload.seconds || 0))));
    const chapterProgress = Math.max(0, Math.min(100, Math.round(Number(payload.chapterProgress ?? payload.progress ?? 0))));
    const bookProgress = Math.max(0, Math.min(100, Math.round(Number(payload.bookProgress ?? payload.progress ?? 0))));
    const page = Math.max(0, Math.min(100000, Math.floor(Number(payload.page || 0))));
    const completed = payload.completed === true;
    const notificationReturn = payload.notificationReturn === true;
    const now = new Date();
    const nowIso = now.toISOString();
    const readingDate = nowIso.slice(0, 10);
    const db = await ensureDb();
    const chapter = await db.prepare(
      `SELECT id FROM chapters WHERE id = ? AND book_id = ? AND status = 'published' LIMIT 1`
    ).bind(chapterId, bookId).first();
    if (!chapter) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });

    await db.batch([
      db.prepare(
        `INSERT INTO reading_sessions
         (visitor_key, chapter_id, book_id, reading_date, seconds, max_progress, completed, notification_return, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(visitor_key, chapter_id, reading_date) DO UPDATE SET
         seconds = reading_sessions.seconds + excluded.seconds,
         max_progress = MAX(reading_sessions.max_progress, excluded.max_progress),
         completed = MAX(reading_sessions.completed, excluded.completed),
         notification_return = MAX(reading_sessions.notification_return, excluded.notification_return),
         updated_at = excluded.updated_at`
      ).bind(
        visitorKey, chapterId, bookId, readingDate, seconds, chapterProgress,
        completed ? 1 : 0, notificationReturn ? 1 : 0, nowIso, nowIso,
      ),
      db.prepare(
        `INSERT INTO reader_library
         (visitor_key, book_id, status, last_chapter_id, last_page, progress, reading_seconds, last_opened_at, created_at, updated_at)
         VALUES (?, ?, 'reading', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(visitor_key, book_id) DO UPDATE SET
         status = CASE WHEN reader_library.status = 'finished' THEN 'finished' ELSE 'reading' END,
         last_chapter_id = excluded.last_chapter_id,
         last_page = excluded.last_page,
         progress = MAX(reader_library.progress, excluded.progress),
         reading_seconds = reader_library.reading_seconds + excluded.reading_seconds,
         last_opened_at = excluded.last_opened_at,
         updated_at = excluded.updated_at`
      ).bind(visitorKey, bookId, chapterId, page, bookProgress, seconds, nowIso, nowIso, nowIso),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить прогресс.' }, { status: 500 });
  }
}
