import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

export async function GET(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const db = await ensureDb();
    const activeSince = new Date(Date.now() - 90 * 1000).toISOString();
    const [online, installs, telegram] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS count FROM reader_presence WHERE updated_at >= ?`).bind(activeSince).first(),
      db.prepare(`SELECT COUNT(*) AS count FROM site_installs`).first(),
      db.prepare(`SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor_key) AS visitors FROM analytics_events WHERE event_type = 'telegram_click'`).first(),
    ]);
    return Response.json({
      onlineReaders: Number(online?.count || 0),
      installs: Number(installs?.count || 0),
      telegramVisitors: Number(telegram?.visitors || 0),
      telegramClicks: Number(telegram?.clicks || 0),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Статистика временно недоступна.' }, { status: 503 });
  }
}
