import { ensureDb } from '../../../../lib/runtime.js';

function safeKey(value) {
  const key = String(value || '').trim().slice(0, 100);
  return /^[a-zA-Z0-9_-]{8,100}$/.test(key) ? key : '';
}

export async function POST(request) {
  try {
    const input = await request.json();
    const visitorKey = safeKey(input.visitorKey);
    if (!visitorKey) return Response.json({ error: 'Не удалось определить устройство.' }, { status: 400 });
    const now = new Date().toISOString();
    const platform = `${String(input.platform || 'unknown')} · ${String(input.source || 'standalone')}`.slice(0, 160);
    await (await ensureDb()).prepare(
      `INSERT INTO site_installs (visitor_key, platform, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(visitor_key) DO UPDATE SET platform = excluded.platform, last_seen_at = excluded.last_seen_at`
    ).bind(visitorKey, platform, now, now).run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Не удалось обновить счётчик.' }, { status: 503 });
  }
}
