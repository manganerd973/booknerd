import { hasReaderAccess } from '../../../../lib/reader-access.js';
import { ensureDb } from '../../../../lib/runtime.js';
import { ACHIEVEMENT_DEFINITIONS, rankForLevel } from '../../../../lib/reader-level-config.js';
import { monthKey, readReaderLevelConfig } from '../../../../lib/reader-levels.js';

function parseList(value) { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function avatarUrl(key) { return key ? `/api/covers/${String(key).split('/').map(encodeURIComponent).join('/')}` : ''; }
function activityLabel(value, visible) {
  if (!visible || !value) return 'скрыто';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return 'сейчас на сайте';
  if (days === 1) return 'была вчера';
  if (days <= 7) return 'была на этой неделе';
  return 'давно не заходила';
}

export async function GET(request, { params }) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  try {
    const { publicId } = await params;
    if (!/^[a-zA-Z0-9]{12,30}$/.test(String(publicId || ''))) return Response.json({ error: 'Профиль не найден.' }, { status: 404 });
    const db = await ensureDb();
    const row = await db.prepare(
      `SELECT s.*, p.display_name, p.photo_key, p.favorite_characters, rl.last_opened_at, rl.book_id AS current_book_id,
              b.title AS current_book_title, b.slug AS current_book_slug, b.genres, b.tropes
       FROM reader_level_stats s LEFT JOIN reader_profiles p ON p.visitor_key = s.visitor_key
       LEFT JOIN reader_library rl ON rl.visitor_key = s.visitor_key AND rl.last_opened_at = (SELECT MAX(x.last_opened_at) FROM reader_library x WHERE x.visitor_key = s.visitor_key)
       LEFT JOIN books b ON b.id = rl.book_id WHERE s.public_id = ? AND s.public_visible = 1 LIMIT 1`
    ).bind(publicId).first();
    if (!row) return Response.json({ error: 'Этот профиль скрыт или не найден.' }, { status: 404 });
    const currentMonth = monthKey();
    const [config, month, monthPosition, allPosition, achievements, awards, shelves] = await Promise.all([
      readReaderLevelConfig(db),
      db.prepare(`SELECT * FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ? LIMIT 1`).bind(row.visitor_key, currentMonth).first(),
      db.prepare(`SELECT 1 + COUNT(*) AS position FROM reader_monthly_stats m JOIN reader_level_stats s ON s.visitor_key = m.visitor_key WHERE m.month_key = ? AND s.public_visible = 1 AND s.rating_status = 'active' AND m.xp > COALESCE((SELECT xp FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ?), 0)`).bind(currentMonth, row.visitor_key, currentMonth).first(),
      db.prepare(`SELECT 1 + COUNT(*) AS position FROM reader_level_stats WHERE public_visible = 1 AND rating_status = 'active' AND total_xp > ?`).bind(Number(row.total_xp || 0)).first(),
      row.achievements_visible ? db.prepare(`SELECT achievement_key, unlocked_at FROM reader_achievements WHERE visitor_key = ? ORDER BY unlocked_at DESC LIMIT 100`).bind(row.visitor_key).all() : Promise.resolve({ results: [] }),
      db.prepare(`SELECT month_key, nomination_key, title, awarded_at FROM reader_monthly_awards WHERE visitor_key = ? ORDER BY awarded_at DESC LIMIT 60`).bind(row.visitor_key).all(),
      db.prepare(`SELECT rl.status, b.title, b.slug, b.cover_key FROM reader_library rl JOIN books b ON b.id = rl.book_id AND b.published = 1 WHERE rl.visitor_key = ? AND rl.status IN ('reading','saved','finished','favorite') ORDER BY rl.updated_at DESC LIMIT 60`).bind(row.visitor_key).all(),
    ]);
    const shelfRows = (shelves.results || []).filter((item) => item.status !== 'saved' || row.planned_shelf_visible).filter((item) => item.status !== 'favorite' || row.favorite_shelf_visible);
    return Response.json({ profile: {
      publicId: row.public_id, displayName: row.display_name || 'Читатель BOOKNERD', avatarUrl: avatarUrl(row.photo_key),
      level: Number(row.level || 1), rank: rankForLevel(Number(row.level || 1), config.ranks), totalXp: Number(row.total_xp || 0),
      monthPosition: Number(monthPosition?.position || 1), allTimePosition: Number(allPosition?.position || 1),
      completedBooks: Number(row.completed_books || 0), completedChapters: Number(row.completed_chapters || 0), completedSeries: Number(row.completed_series || 0),
      savedQuotes: Number(row.saved_quotes || 0), approvedReviews: Number(row.approved_reviews || 0),
      favoriteGenres: parseList(row.genres).slice(0, 8), favoriteTropes: parseList(row.tropes).slice(0, 8),
      activity: activityLabel(row.last_opened_at, Boolean(row.online_visible)),
      currentBook: row.current_book_visible && row.current_book_id ? { title: row.current_book_title, slug: row.current_book_slug } : null,
      monthly: month ? { xp: Number(month.xp || 0), books: Number(month.completed_books || 0), chapters: Number(month.completed_chapters || 0) } : { xp: 0, books: 0, chapters: 0 },
      achievements: (achievements.results || []).map((item) => { const definition = ACHIEVEMENT_DEFINITIONS.find((candidate) => candidate.key === item.achievement_key); return definition ? { ...definition, unlockedAt: item.unlocked_at } : null; }).filter(Boolean),
      awards: awards.results || [],
      shelves: shelfRows.map((item) => ({ status: item.status, title: item.title, slug: item.slug, coverUrl: item.cover_key ? `/api/covers/${String(item.cover_key).split('/').map(encodeURIComponent).join('/')}` : '' })),
    } });
  } catch (error) {
    return Response.json({ error: error.message || 'Профиль временно недоступен.' }, { status: 503 });
  }
}
