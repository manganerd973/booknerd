import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';
import { ACHIEVEMENT_DEFINITIONS } from '../../../lib/reader-level-config.js';
import { mapLevelSummary, monthKey, normalizeReaderKey, previousMonthKey, readReaderLevelConfig, refreshReaderLevel } from '../../../lib/reader-levels.js';
import { jsonWithReaderIdentity, verifyOrCreateReaderIdentity } from '../../../lib/reader-identity.js';

async function denied(request) {
  return await hasReaderAccess(request) ? null : Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

function mapAchievement(row) {
  const definition = ACHIEVEMENT_DEFINITIONS.find((item) => item.key === row.achievement_key);
  return definition ? { ...definition, unlockedAt: row.unlocked_at } : null;
}

export async function GET(request) {
  const accessDenied = await denied(request);
  if (accessDenied) return accessDenied;
  try {
    const visitorKey = normalizeReaderKey(new URL(request.url).searchParams.get('visitorKey'));
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    const identity = await verifyOrCreateReaderIdentity(request, visitorKey);
    if (!identity.valid) return Response.json({ error: 'Профиль чтения не совпадает с защищённой сессией.' }, { status: 403 });
    const db = await ensureDb();
    let row = await db.prepare(`SELECT * FROM reader_level_stats WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first();
    if (!row) {
      await refreshReaderLevel({ db, visitorKey, legacyBackfill: true, suppressNotifications: true });
      row = await db.prepare(`SELECT * FROM reader_level_stats WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first();
    }
    const currentMonth = monthKey();
    const [monthly, achievements, awards, monthPosition, allPosition, previousMonth] = await Promise.all([
      db.prepare(`SELECT * FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ? LIMIT 1`).bind(visitorKey, currentMonth).first(),
      db.prepare(`SELECT achievement_key, unlocked_at FROM reader_achievements WHERE visitor_key = ? ORDER BY unlocked_at DESC`).bind(visitorKey).all(),
      db.prepare(`SELECT month_key, nomination_key, title, awarded_at FROM reader_monthly_awards WHERE visitor_key = ? ORDER BY awarded_at DESC LIMIT 60`).bind(visitorKey).all(),
      db.prepare(`SELECT 1 + COUNT(*) AS position FROM reader_monthly_stats m JOIN reader_level_stats s ON s.visitor_key = m.visitor_key WHERE m.month_key = ? AND s.rating_status = 'active' AND (m.xp > COALESCE((SELECT xp FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ?), 0) OR (m.xp = COALESCE((SELECT xp FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ?), 0) AND m.reached_xp_at < COALESCE((SELECT reached_xp_at FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ?), '9999')))`).bind(currentMonth, visitorKey, currentMonth, visitorKey, currentMonth, visitorKey, currentMonth).first(),
      db.prepare(`SELECT 1 + COUNT(*) AS position FROM reader_level_stats WHERE rating_status = 'active' AND (total_xp > ? OR (total_xp = ? AND COALESCE(first_counted_at, created_at) < COALESCE(?, '9999')))`).bind(Number(row?.total_xp || 0), Number(row?.total_xp || 0), row?.first_counted_at || row?.created_at).first(),
      db.prepare(`SELECT * FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ? LIMIT 1`).bind(visitorKey, previousMonthKey()).first(),
    ]);
    const config = await readReaderLevelConfig(db);
    const mappedAchievements = (achievements.results || []).map(mapAchievement).filter(Boolean);
    return jsonWithReaderIdentity({
      summary: mapLevelSummary(row, config, mappedAchievements, awards.results || []),
      monthly: monthly ? { monthKey: monthly.month_key, xp: Number(monthly.xp || 0), completedChapters: Number(monthly.completed_chapters || 0), completedBooks: Number(monthly.completed_books || 0), position: Number(monthPosition?.position || 1) } : { monthKey: currentMonth, xp: 0, completedChapters: 0, completedBooks: 0, position: 1 },
      allTimePosition: Number(allPosition?.position || 1),
      previousMonth: previousMonth ? { monthKey: previousMonth.month_key, xp: Number(previousMonth.xp || 0), completedChapters: Number(previousMonth.completed_chapters || 0), completedBooks: Number(previousMonth.completed_books || 0) } : null,
      definitions: ACHIEVEMENT_DEFINITIONS,
    }, identity);
  } catch (error) {
    return Response.json({ error: error.message || 'Система уровней временно недоступна.' }, { status: 503 });
  }
}

export async function POST(request) {
  const accessDenied = await denied(request);
  if (accessDenied) return accessDenied;
  try {
    const payload = await request.json();
    const visitorKey = normalizeReaderKey(payload.visitorKey);
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    const identity = await verifyOrCreateReaderIdentity(request, visitorKey);
    if (!identity.valid) return Response.json({ error: 'Профиль чтения не совпадает с защищённой сессией.' }, { status: 403 });
    const flags = {
      public_visible: payload.publicVisible === false ? 0 : 1,
      online_visible: payload.onlineVisible === false ? 0 : 1,
      current_book_visible: payload.currentBookVisible === false ? 0 : 1,
      planned_shelf_visible: payload.plannedShelfVisible === false ? 0 : 1,
      favorite_shelf_visible: payload.favoriteShelfVisible === false ? 0 : 1,
      achievements_visible: payload.achievementsVisible === false ? 0 : 1,
    };
    const db = await ensureDb();
    await refreshReaderLevel({ db, visitorKey, suppressNotifications: true });
    await db.prepare(`UPDATE reader_level_stats SET public_visible = ?, online_visible = ?, current_book_visible = ?, planned_shelf_visible = ?, favorite_shelf_visible = ?, achievements_visible = ?, updated_at = ? WHERE visitor_key = ?`)
      .bind(flags.public_visible, flags.online_visible, flags.current_book_visible, flags.planned_shelf_visible, flags.favorite_shelf_visible, flags.achievements_visible, new Date().toISOString(), visitorKey).run();
    return jsonWithReaderIdentity({ ok: true }, identity);
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить настройки публичности.' }, { status: 500 });
  }
}
