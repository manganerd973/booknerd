import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';
import { cachedRead } from '../../../lib/read-cache.js';

export async function GET(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала войдите на сайт.' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') === 'day' ? 'day' : 'month';
    const parsed = Number(url.searchParams.get('offset') || 0);
    const offset = Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, 100000) : 0;
    const limit = url.searchParams.get('preview') === '1' ? 5 : 25;
    const today = new Date().toISOString().slice(0, 10);
    const start = period === 'day' ? today : `${today.slice(0, 7)}-01`;
    const data = await cachedRead(`reading-leaders:${period}:${today}:${offset}:${limit}`, 300000, async () => {
      const db = await ensureDb();
      const result = await db.prepare(`SELECT s.public_id, p.display_name,
        COUNT(DISTINCT CASE WHEN r.completed = 1 THEN r.chapter_id END) AS chapters,
        SUM(r.seconds) AS seconds, COUNT(*) OVER () AS total
        FROM reader_level_stats s
        JOIN reading_sessions r ON r.visitor_key = s.visitor_key
        LEFT JOIN reader_profiles p ON p.visitor_key = s.visitor_key
        WHERE s.public_visible = 1 AND s.rating_status = 'active'
          AND r.reading_date >= ? AND r.reading_date <= ?
        GROUP BY s.visitor_key
        HAVING SUM(r.seconds) > 0 OR MAX(r.completed) = 1
        ORDER BY chapters DESC, seconds DESC, s.public_id ASC LIMIT ? OFFSET ?`)
        .bind(start, today, limit, offset).all();
      const rows = result.results || [];
      return { readers: rows.map((row, index) => ({ publicId: row.public_id,
        name: row.display_name || 'Читатель BOOKNERD', position: offset + index + 1,
        chapters: Number(row.chapters || 0), minutes: Math.floor(Number(row.seconds || 0) / 60) })),
        total: Number(rows[0]?.total || 0), period, start, end: today };
    });
    return Response.json(data);
  } catch { return Response.json({ error: 'Не удалось загрузить читателей. Попробуйте ещё раз.' }, { status: 503 }); }
}
