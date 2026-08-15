import { hasReaderAccess } from '../../../lib/reader-access.js';
import { mapReaderNotification, syncReaderNotifications } from '../../../lib/reader-notifications.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
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
        `SELECT id, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, created_at
         FROM reader_notifications
         WHERE visitor_key = ?
         ORDER BY created_at DESC
         LIMIT 150`
      ).bind(visitorKey),
      db.prepare(
        `SELECT COUNT(*) AS count FROM reader_notifications WHERE visitor_key = ? AND read_at IS NULL`
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
      await db.prepare(`UPDATE reader_notifications SET read_at = ? WHERE visitor_key = ? AND read_at IS NULL`)
        .bind(now, visitorKey).run();
      return Response.json({ ok: true, readAt: now, unreadCount: 0 });
    }
    const id = String(payload.id || '').trim().slice(0, 360);
    if (!id) return Response.json({ error: 'Уведомление не указано.' }, { status: 400 });
    await db.prepare(`UPDATE reader_notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND visitor_key = ?`)
      .bind(now, id, visitorKey).run();
    const unread = await db.prepare(
      `SELECT COUNT(*) AS count FROM reader_notifications WHERE visitor_key = ? AND read_at IS NULL`
    ).bind(visitorKey).first();
    return Response.json({ ok: true, readAt: now, unreadCount: Number(unread?.count || 0) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось обновить уведомление.' }, { status: 500 });
  }
}
