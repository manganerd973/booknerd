import { hasReaderAccess } from '../../../lib/reader-access.js';
import { cachedRead } from '../../../lib/read-cache.js';
import { ensureDb } from '../../../lib/runtime.js';
import { ACHIEVEMENT_DEFINITIONS, rankForLevel } from '../../../lib/reader-level-config.js';
import { monthKey, normalizeReaderKey, previousMonthKey, readReaderLevelConfig } from '../../../lib/reader-levels.js';

const CACHE_MS = 10 * 60 * 1000;

function parseList(value) {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function avatarUrl(key) {
  return key ? `/api/covers/${String(key).split('/').map(encodeURIComponent).join('/')}` : '';
}

function achievement(key) {
  return ACHIEVEMENT_DEFINITIONS.find((item) => item.key === key) || null;
}

function mapCard(row, config, position) {
  const genres = parseList(row.favorite_genres);
  return {
    publicId: row.public_id,
    displayName: row.display_name || 'Читатель BOOKNERD',
    avatarUrl: avatarUrl(row.photo_key),
    level: Number(row.level || 1),
    rank: rankForLevel(Number(row.level || 1), config.ranks),
    totalXp: Number(row.total_xp || 0),
    monthXp: Number(row.month_xp || 0),
    completedBooks: Number(row.month_books || 0),
    completedChapters: Number(row.month_chapters || 0),
    allCompletedBooks: Number(row.completed_books || 0),
    position,
    positionChange: row.previous_position ? Number(row.previous_position) - position : null,
    favoriteGenre: genres[0] || 'ещё определяется',
    latestAchievement: achievement(row.latest_achievement),
    metrics: {
      levelGrowth: Number(row.level_growth || 0), genreCount: Number(row.genre_count || 0),
      completedSeries: Number(row.month_series || 0), approvedReviews: Number(row.approved_reviews || 0),
      confirmedErrors: Number(row.confirmed_errors || 0), quotesSaved: Number(row.quotes_saved || 0),
    },
  };
}

async function loadPublicRows(db, config, currentMonth) {
  const result = await db.prepare(
    `WITH previous AS (
       SELECT pm.visitor_key, ROW_NUMBER() OVER (ORDER BY pm.xp DESC, pm.completed_books DESC, pm.unique_reading_days DESC, pm.completed_chapters DESC, COALESCE(pm.reached_xp_at, pm.updated_at) ASC) AS previous_position
       FROM reader_monthly_stats pm JOIN reader_level_stats ps ON ps.visitor_key = pm.visitor_key
       WHERE pm.month_key = ? AND ps.public_visible = 1 AND ps.rating_status = 'active'
     )
     SELECT s.public_id, s.total_xp, s.level, s.completed_books, s.favorite_genres, p.display_name, p.photo_key, previous.previous_position,
            m.xp AS month_xp, m.completed_books AS month_books, m.completed_chapters AS month_chapters,
            m.completed_series AS month_series, m.approved_reviews, m.confirmed_errors, m.genre_count, m.quotes_saved, m.level_growth,
            (SELECT achievement_key FROM reader_achievements a WHERE a.visitor_key = s.visitor_key ORDER BY unlocked_at DESC LIMIT 1) AS latest_achievement
     FROM reader_level_stats s
     LEFT JOIN reader_monthly_stats m ON m.visitor_key = s.visitor_key AND m.month_key = ?
     LEFT JOIN reader_profiles p ON p.visitor_key = s.visitor_key
     LEFT JOIN previous ON previous.visitor_key = s.visitor_key
     WHERE s.public_visible = 1 AND s.rating_status = 'active'
     ORDER BY m.xp DESC, m.completed_books DESC, m.unique_reading_days DESC, m.completed_chapters DESC, COALESCE(m.reached_xp_at, m.updated_at) ASC
     LIMIT 100`
  ).bind(previousMonthKey(), currentMonth).all();
  return (result.results || []).map((row, index) => mapCard(row, config, index + 1));
}

function nominationWinner(rows, key, used) {
  const metric = { 'rising-reader': 'levelGrowth', 'genre-explorer': 'genreCount', 'series-keeper': 'completedSeries', 'community-voice': 'approvedReviews', 'sharp-editor': 'confirmedErrors', 'quote-collector': 'quotesSaved' }[key];
  if (!metric) return null;
  return [...rows].filter((row) => !used.has(row.publicId) && row.metrics[metric] > 0)
    .sort((a, b) => b.metrics[metric] - a.metrics[metric] || b.monthXp - a.monthXp || a.position - b.position)[0] || null;
}

export async function GET(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const visitorKey = normalizeReaderKey(url.searchParams.get('visitorKey'));
    const view = String(url.searchParams.get('view') || 'month');
    const db = await ensureDb();
    const config = await readReaderLevelConfig(db);
    const currentMonth = monthKey();
    const monthRows = await cachedRead(`reader-rankings:${currentMonth}`, CACHE_MS, () => loadPublicRows(db, config, currentMonth));
    if (view === 'home') {
      const master = monthRows[0] || null;
      const used = new Set(master ? [master.publicId] : []);
      const nominations = [];
      for (const nomination of config.nominations.filter((item) => item.enabled !== false && item.key !== 'master-month')) {
        const reader = nominationWinner(monthRows, nomination.key, used);
        if (!reader) continue;
        used.add(reader.publicId);
        nominations.push({ ...nomination, reader });
        if (nominations.length >= Math.max(1, Math.min(5, Number(config.homeCardCount || 5)))) break;
      }
      return Response.json({ master, nominations });
    }
    let rows = monthRows;
    if (view === 'all') {
      rows = await cachedRead('reader-rankings:all', CACHE_MS, async () => {
        const result = await db.prepare(
          `SELECT s.public_id, s.total_xp, s.level, s.completed_books, s.favorite_genres, p.display_name, p.photo_key,
                  0 AS month_xp, s.completed_books AS month_books, s.completed_chapters AS month_chapters, s.completed_series AS month_series, s.approved_reviews,
                  0 AS confirmed_errors, 0 AS genre_count, 0 AS quotes_saved, 0 AS level_growth,
                  (SELECT achievement_key FROM reader_achievements a WHERE a.visitor_key = s.visitor_key ORDER BY unlocked_at DESC LIMIT 1) AS latest_achievement
           FROM reader_level_stats s LEFT JOIN reader_profiles p ON p.visitor_key = s.visitor_key
           WHERE s.public_visible = 1 AND s.rating_status = 'active'
           ORDER BY s.total_xp DESC, s.completed_books DESC, s.unique_reading_days DESC, s.completed_chapters DESC, COALESCE(s.first_counted_at, s.created_at) ASC LIMIT 100`
        ).all();
        return (result.results || []).map((row, index) => mapCard(row, config, index + 1));
      });
    }
    const ownPublicId = visitorKey ? (await db.prepare(`SELECT public_id FROM reader_level_stats WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first())?.public_id : '';
    const ownIndex = rows.findIndex((item) => item.publicId === ownPublicId);
    let own = ownIndex >= 0 ? rows[ownIndex] : null;
    if (!own && visitorKey) {
      const ownRow = await db.prepare(
        `SELECT s.public_id, s.total_xp, s.level, s.completed_books, s.favorite_genres, p.display_name, p.photo_key,
                COALESCE(m.xp,0) AS month_xp, COALESCE(m.completed_books,0) AS month_books, COALESCE(m.completed_chapters,0) AS month_chapters,
                COALESCE(m.completed_series,0) AS month_series, COALESCE(m.approved_reviews,0) AS approved_reviews,
                COALESCE(m.confirmed_errors,0) AS confirmed_errors, COALESCE(m.genre_count,0) AS genre_count,
                COALESCE(m.quotes_saved,0) AS quotes_saved, COALESCE(m.level_growth,0) AS level_growth,
                (SELECT achievement_key FROM reader_achievements a WHERE a.visitor_key = s.visitor_key ORDER BY unlocked_at DESC LIMIT 1) AS latest_achievement
         FROM reader_level_stats s LEFT JOIN reader_profiles p ON p.visitor_key = s.visitor_key
         LEFT JOIN reader_monthly_stats m ON m.visitor_key = s.visitor_key AND m.month_key = ? WHERE s.visitor_key = ? LIMIT 1`
      ).bind(currentMonth, visitorKey).first();
      if (ownRow) {
        const position = view === 'all'
          ? Number((await db.prepare(`WITH own AS (SELECT total_xp, completed_books, unique_reading_days, completed_chapters, COALESCE(first_counted_at, created_at) AS reached_at FROM reader_level_stats WHERE visitor_key = ?) SELECT 1 + COUNT(*) AS position FROM reader_level_stats s CROSS JOIN own o WHERE s.rating_status = 'active' AND (s.total_xp > o.total_xp OR (s.total_xp = o.total_xp AND (s.completed_books > o.completed_books OR (s.completed_books = o.completed_books AND (s.unique_reading_days > o.unique_reading_days OR (s.unique_reading_days = o.unique_reading_days AND (s.completed_chapters > o.completed_chapters OR (s.completed_chapters = o.completed_chapters AND COALESCE(s.first_counted_at, s.created_at) < o.reached_at))))))))`).bind(visitorKey).first())?.position || 1)
          : Number((await db.prepare(`WITH own AS (SELECT xp, completed_books, unique_reading_days, completed_chapters, COALESCE(reached_xp_at, updated_at) AS reached_at FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ?) SELECT 1 + COUNT(*) AS position FROM reader_monthly_stats m CROSS JOIN own o JOIN reader_level_stats s ON s.visitor_key = m.visitor_key WHERE m.month_key = ? AND s.rating_status = 'active' AND (m.xp > o.xp OR (m.xp = o.xp AND (m.completed_books > o.completed_books OR (m.completed_books = o.completed_books AND (m.unique_reading_days > o.unique_reading_days OR (m.unique_reading_days = o.unique_reading_days AND (m.completed_chapters > o.completed_chapters OR (m.completed_chapters = o.completed_chapters AND COALESCE(m.reached_xp_at, m.updated_at) < o.reached_at))))))))`).bind(visitorKey, currentMonth, currentMonth).first())?.position || 1);
        own = mapCard(ownRow, config, position);
      }
    }
    const top = rows.slice(0, 20);
    const comparableXp = (item) => view === 'all' ? item.totalXp : item.monthXp;
    const insertionIndex = ownIndex >= 0 ? ownIndex : own ? rows.findIndex((item) => comparableXp(item) <= comparableXp(own)) : -1;
    const neighbors = insertionIndex >= 0 ? rows.slice(Math.max(0, insertionIndex - 2), insertionIndex + 3) : [];
    const awards = view === 'nominations' ? (await db.prepare(
      `SELECT a.month_key, a.nomination_key, a.title, a.awarded_at, s.public_id, s.level, s.total_xp, p.display_name, p.photo_key
       FROM reader_monthly_awards a JOIN reader_level_stats s ON s.visitor_key = a.visitor_key LEFT JOIN reader_profiles p ON p.visitor_key = a.visitor_key
       WHERE s.public_visible = 1 ORDER BY a.awarded_at DESC LIMIT 100`
    ).all()).results || [] : [];
    return Response.json({ rows: top, neighbors, own, total: rows.length, awards, ranks: config.ranks, nominations: config.nominations });
  } catch (error) {
    return Response.json({ error: error.message || 'Рейтинг временно недоступен.' }, { status: 503 });
  }
}
