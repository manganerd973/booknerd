import { hasReaderAccess } from '../../../lib/reader-access.js';
import { mapReaderNotification, syncReaderNotifications } from '../../../lib/reader-notifications.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function normalizeIds(payload) {
  const values = Array.isArray(payload.ids) ? payload.ids : [payload.id];
  return [...new Set(values.map((value) => String(value || '').trim().slice(0, 360)).filter(Boolean))].slice(0, 150);
}

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

export async function GET(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const visitorKey = normalizeVisitorKey(new URL(request.url).searchParams.get('visitorKey'));
    if (!visitorKey) return Response.json({ notifications: [], unreadCount: 0 });
    const db = await syncReaderNotifications(visitorKey);
    const [items, unread] = await db.batch([
      db.prepare(
        `SELECT rn.id, rn.type, rn.book_id, rn.chapter_id, rn.comment_id, rn.actor_name,
                rn.title, rn.body, rn.url, rn.read_at, rn.hidden_at, rn.created_at,
                b.slug AS book_slug, b.title AS book_title, b.cover_key,
                chapter.chapter_number, chapter.title AS chapter_title,
                rl.last_chapter_id, rl.last_page,
                last_chapter.chapter_number AS last_chapter_number,
                last_chapter.title AS last_chapter_title
         FROM reader_notifications rn
         LEFT JOIN books b ON b.id = rn.book_id
         LEFT JOIN chapters chapter ON chapter.id = rn.chapter_id
         LEFT JOIN reader_library rl ON rl.visitor_key = rn.visitor_key AND rl.book_id = rn.book_id
         LEFT JOIN chapters last_chapter ON last_chapter.id = rl.last_chapter_id
         WHERE rn.visitor_key = ?
         ORDER BY rn.created_at DESC
         LIMIT 150`
      ).bind(visitorKey),
      db.prepare(
        `SELECT COUNT(*) AS count FROM reader_notifications WHERE visitor_key = ? AND read_at IS NULL AND hidden_at IS NULL`
      ).bind(visitorKey),
    ]);
    return Response.json({
      notifications: (items.results || []).map(mapReaderNotification),
      unreadCount: Number(unread.results?.[0]?.count || 0),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть уведомления.' }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    if (!visitorKey) return Response.json({ error: 'Не удалось определить читателя.' }, { status: 400 });
    const db = await syncReaderNotifications(visitorKey);
    const now = new Date().toISOString();
    if (payload.action === 'mark-all-read') {
      await db.prepare(`UPDATE reader_notifications SET read_at = ? WHERE visitor_key = ? AND read_at IS NULL AND hidden_at IS NULL`)
        .bind(now, visitorKey).run();
      return Response.json({ ok: true, readAt: now, unreadCount: 0 });
    }
    if (payload.action === 'hide-read') {
      await db.prepare(
        `UPDATE reader_notifications SET hidden_at = ? WHERE visitor_key = ? AND read_at IS NOT NULL AND hidden_at IS NULL`
      ).bind(now, visitorKey).run();
    } else {
      const ids = normalizeIds(payload);
      if (!ids.length) return Response.json({ error: 'Уведомление не указано.' }, { status: 400 });
      const placeholders = ids.map(() => '?').join(',');
      if (payload.action === 'hide') {
        await db.prepare(
          `UPDATE reader_notifications SET hidden_at = ?, read_at = COALESCE(read_at, ?) WHERE visitor_key = ? AND id IN (${placeholders})`
        ).bind(now, now, visitorKey, ...ids).run();
      } else if (payload.action === 'restore') {
        await db.prepare(
          `UPDATE reader_notifications SET hidden_at = NULL WHERE visitor_key = ? AND id IN (${placeholders})`
        ).bind(visitorKey, ...ids).run();
      } else {
        await db.prepare(
          `UPDATE reader_notifications SET read_at = COALESCE(read_at, ?) WHERE visitor_key = ? AND id IN (${placeholders})`
        ).bind(now, visitorKey, ...ids).run();
      }
    }
    const unread = await db.prepare(
      `SELECT COUNT(*) AS count FROM reader_notifications WHERE visitor_key = ? AND read_at IS NULL AND hidden_at IS NULL`
    ).bind(visitorKey).first();
    return Response.json({ ok: true, readAt: now, unreadCount: Number(unread?.count || 0) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось обновить уведомление.' }, { status: 500 });
  }
}
