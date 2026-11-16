import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';

async function respond(request, update) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Откройте доступ к чтению.' }, { status: 401 });
  try {
    const input = update ? await request.json() : Object.fromEntries(new URL(request.url).searchParams);
    const chapterId = String(input.chapterId || '').trim();
    const visitorKey = String(input.visitorKey || '').trim();
    if (!chapterId || chapterId.length > 100 || !/^[a-zA-Z0-9:_-]{8,120}$/.test(visitorKey) || (update && typeof input.liked !== 'boolean')) {
      return Response.json({ error: 'Не удалось определить главу или читателя.' }, { status: 400 });
    }
    const db = await ensureDb();
    const chapter = await db.prepare(`SELECT c.id FROM chapters c JOIN books b ON b.id = c.book_id
      WHERE c.id = ? AND c.status = 'published' AND b.published = 1`).bind(chapterId).first();
    if (!chapter) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    if (update) {
      const statement = input.liked
        ? 'INSERT OR IGNORE INTO chapter_likes (chapter_id, visitor_key) VALUES (?, ?)'
        : 'DELETE FROM chapter_likes WHERE chapter_id = ? AND visitor_key = ?';
      await db.prepare(statement).bind(chapterId, visitorKey).run();
    }
    const result = await db.prepare('SELECT COUNT(*) AS total, MAX(visitor_key = ?) AS liked FROM chapter_likes WHERE chapter_id = ?')
      .bind(visitorKey, chapterId).first();
    return Response.json({ total: Number(result?.total || 0), liked: Boolean(result?.liked) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Не удалось загрузить отметки главы.' }, { status: 503 });
  }
}

export const GET = (request) => respond(request, false);
export const POST = (request) => respond(request, true);
