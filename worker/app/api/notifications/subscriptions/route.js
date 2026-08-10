import { ensureDb } from '../../../../lib/runtime.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function normalizeEndpoint(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString().slice(0, 2000) : '';
  } catch {
    return '';
  }
}

export async function GET(request) {
  try {
    const visitorKey = normalizeVisitorKey(new URL(request.url).searchParams.get('visitorKey'));
    if (!visitorKey) return Response.json({ subscribed: false });
    const row = await (await ensureDb()).prepare(
      `SELECT endpoint FROM push_subscriptions WHERE visitor_key = ? LIMIT 1`
    ).bind(visitorKey).first();
    return Response.json({ subscribed: Boolean(row) });
  } catch {
    return Response.json({ subscribed: false });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const endpoint = normalizeEndpoint(payload.subscription?.endpoint || payload.endpoint);
    if (!visitorKey || !endpoint) {
      return Response.json({ error: 'Не удалось сохранить уведомления.' }, { status: 400 });
    }
    const db = await ensureDb();
    if (payload.action === 'unsubscribe') {
      await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? OR visitor_key = ?`).bind(endpoint, visitorKey).run();
      return Response.json({ ok: true, subscribed: false });
    }
    const p256dh = String(payload.subscription?.keys?.p256dh || '').trim().slice(0, 500);
    const auth = String(payload.subscription?.keys?.auth || '').trim().slice(0, 500);
    if (!p256dh || !auth) return Response.json({ error: 'Телефон не передал ключ уведомлений.' }, { status: 400 });
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO push_subscriptions (endpoint, visitor_key, p256dh, auth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
       visitor_key = excluded.visitor_key,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       updated_at = excluded.updated_at`
    ).bind(endpoint, visitorKey, p256dh, auth, now, now).run();
    return Response.json({ ok: true, subscribed: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось включить уведомления.' }, { status: 500 });
  }
}
