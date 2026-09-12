import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';
import { markReaderForReview, normalizeReaderKey, refreshReaderLevel } from '../../../lib/reader-levels.js';
import { jsonWithReaderIdentity, verifyOrCreateReaderIdentity } from '../../../lib/reader-identity.js';

const activity = new Map();

function cleanId(value) { return String(value || '').trim().slice(0, 100); }
function localReadingDate(date) { return new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10); }

function activitySignal(request, visitorKey, chapterId) {
  const now = Date.now();
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const key = `${ip}:${visitorKey}`;
  const recent = (activity.get(key) || []).filter((item) => now - item.time < 5 * 60 * 1000);
  recent.push({ time: now, chapterId });
  activity.set(key, recent.slice(-140));
  if (activity.size > 1000) {
    for (const [candidate, rows] of activity) if (!rows.some((item) => now - item.time < 5 * 60 * 1000)) activity.delete(candidate);
  }
  const rapidChapters = new Set(recent.filter((item) => now - item.time < 2 * 60 * 1000).map((item) => item.chapterId)).size;
  if (rapidChapters > 8) return 'За две минуты открыто слишком много разных глав.';
  if (recent.length > 120) return 'Слишком много запросов прогресса за короткое время.';
  return '';
}

export async function POST(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  try {
    const payload = await request.json();
    const visitorKey = normalizeReaderKey(payload.visitorKey);
    const bookId = cleanId(payload.bookId);
    const chapterId = cleanId(payload.chapterId);
    if (!visitorKey || !bookId || !chapterId) return Response.json({ error: 'Не удалось сохранить прогресс чтения.' }, { status: 400 });
    const identity = await verifyOrCreateReaderIdentity(request, visitorKey);
    if (!identity.valid) return Response.json({ error: 'Профиль чтения не совпадает с защищённой сессией.' }, { status: 403 });
    const seconds = Math.max(0, Math.min(payload.offlineSync ? 7200 : 120, Math.floor(Number(payload.seconds || 0))));
    const chapterProgress = Math.max(0, Math.min(100, Math.round(Number(payload.chapterProgress ?? payload.progress ?? 0))));
    const bookProgress = Math.max(0, Math.min(100, Math.round(Number(payload.bookProgress ?? payload.progress ?? 0))));
    const page = Math.max(0, Math.min(100000, Math.floor(Number(payload.page || 0))));
    const completionRequested = payload.completed === true;
    const now = new Date();
    const nowIso = now.toISOString();
    const readingDate = localReadingDate(now);
    const db = await ensureDb();
    const signal = activitySignal(request, visitorKey, chapterId);
    if (signal) await markReaderForReview(db, visitorKey, signal).catch(() => {});
    const [chapter, today, previouslyCompleted] = await Promise.all([
      db.prepare(`SELECT id FROM chapters WHERE id = ? AND book_id = ? AND status = 'published' LIMIT 1`).bind(chapterId, bookId).first(),
      db.prepare(`SELECT seconds, max_progress, completed, started_at FROM reading_sessions WHERE visitor_key = ? AND chapter_id = ? AND reading_date = ? LIMIT 1`).bind(visitorKey, chapterId, readingDate).first(),
      db.prepare(`SELECT 1 AS found FROM reading_sessions WHERE visitor_key = ? AND chapter_id = ? AND completed = 1 LIMIT 1`).bind(visitorKey, chapterId).first(),
    ]);
    if (!chapter) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    const elapsed = today?.started_at ? Math.max(0, (now.getTime() - new Date(today.started_at).getTime()) / 1000) : 0;
    const progressedNaturally = Number(today?.max_progress || 0) >= 20 || Number(today?.seconds || 0) > 0;
    const completionVerified = Boolean(previouslyCompleted || (completionRequested && chapterProgress >= 95 && elapsed >= 8 && progressedNaturally && !signal));
    const newlyCompleted = completionVerified && !previouslyCompleted;
    await db.batch([
      db.prepare(
        `INSERT INTO reading_sessions
         (visitor_key, chapter_id, book_id, reading_date, seconds, max_progress, completed, notification_return, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(visitor_key, chapter_id, reading_date) DO UPDATE SET
          seconds = MIN(86400, reading_sessions.seconds + excluded.seconds),
          max_progress = MAX(reading_sessions.max_progress, excluded.max_progress),
          completed = MAX(reading_sessions.completed, excluded.completed),
          notification_return = MAX(reading_sessions.notification_return, excluded.notification_return), updated_at = excluded.updated_at`
      ).bind(visitorKey, chapterId, bookId, readingDate, seconds, chapterProgress, completionVerified ? 1 : 0, payload.notificationReturn === true ? 1 : 0, nowIso, nowIso),
      db.prepare(
        `INSERT INTO reader_library
         (visitor_key, book_id, status, last_chapter_id, last_page, progress, reading_seconds, last_opened_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(visitor_key, book_id) DO UPDATE SET
          status = CASE WHEN reader_library.status IN ('finished','favorite') THEN reader_library.status WHEN excluded.status = 'finished' THEN 'finished' ELSE 'reading' END,
          last_chapter_id = excluded.last_chapter_id, last_page = excluded.last_page,
          progress = MAX(reader_library.progress, excluded.progress),
          reading_seconds = MIN(31536000, reader_library.reading_seconds + excluded.reading_seconds),
          last_opened_at = excluded.last_opened_at, updated_at = excluded.updated_at`
      ).bind(visitorKey, bookId, completionVerified && bookProgress >= 100 ? 'finished' : 'reading', chapterId, page, bookProgress, seconds, nowIso, nowIso, nowIso),
    ]);
    const summary = newlyCompleted ? await refreshReaderLevel({ db, visitorKey }).catch(() => null) : null;
    return jsonWithReaderIdentity({
      ok: true, completionAccepted: completionVerified, newlyCompleted,
      levelEvent: summary && (summary.levelChanged || summary.newAchievements.length) ? {
        level: summary.level, rank: summary.rank, progress: summary.progress,
        rankChanged: summary.rankChanged, newAchievements: summary.newAchievements,
      } : null,
    }, identity);
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить прогресс.' }, { status: 500 });
  }
}
