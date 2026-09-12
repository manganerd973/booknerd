import { cachedRead, invalidateCachedRead } from './read-cache.js';
import {
  ACHIEVEMENT_DEFINITIONS,
  DEFAULT_READER_LEVEL_CONFIG,
  levelForXp,
  levelProgress,
  parseJson,
  rankForLevel,
  sanitizeReaderLevelConfig,
  xpForLevel,
} from './reader-level-config.js';

const CONFIG_CACHE_MS = 30 * 60 * 1000;
const DUSHANBE_OFFSET_MS = 5 * 60 * 60 * 1000;

export function normalizeReaderKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

export function monthKey(date = new Date()) {
  return new Date(date.getTime() + DUSHANBE_OFFSET_MS).toISOString().slice(0, 7);
}

export function previousMonthKey(date = new Date()) {
  const shifted = new Date(date.getTime() + DUSHANBE_OFFSET_MS);
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() - 1);
  return shifted.toISOString().slice(0, 7);
}

export async function readReaderLevelConfig(db) {
  return cachedRead('reader-level-config:v48', CONFIG_CACHE_MS, async () => {
    try {
      const row = await db.prepare(`SELECT config FROM reader_level_config WHERE id = 'global' LIMIT 1`).first();
      return sanitizeReaderLevelConfig(parseJson(row?.config, DEFAULT_READER_LEVEL_CONFIG));
    } catch {
      return sanitizeReaderLevelConfig(DEFAULT_READER_LEVEL_CONFIG);
    }
  });
}

function isoWeekKey(value) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function readingWeekBonuses(rows) {
  const weeks = new Map();
  for (const row of rows) {
    const date = String(row.reading_date || '');
    const week = isoWeekKey(date);
    if (!week) continue;
    const dates = weeks.get(week) || [];
    if (!dates.includes(date)) dates.push(date);
    weeks.set(week, dates.sort());
  }
  return [...weeks.values()].filter((dates) => dates.length >= 3).map((dates) => dates[2]);
}

function safeList(value) {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function completedSeriesFromBooks(books) {
  const grouped = new Map();
  for (const book of books) {
    const title = String(book.series_title || '').trim();
    if (!title) continue;
    const items = grouped.get(title) || [];
    items.push(book);
    grouped.set(title, items);
  }
  return [...grouped.entries()].filter(([, items]) => items.length > 1 && items.every((item) => item.is_completed))
    .map(([title, items]) => ({ key: title.toLocaleLowerCase('ru-RU'), completedAt: items.map((item) => item.completed_at || '').sort().at(-1) || '' }));
}

function achievementKeys(metrics) {
  const keys = [];
  if (metrics.completedChapters >= 1) keys.push('first-chapter');
  if (metrics.completedBooks >= 1) keys.push('first-book');
  if (metrics.completedSeries >= 1) keys.push('first-series', 'series-keeper');
  if (metrics.completedBooks >= 5) keys.push('five-books');
  if (metrics.completedBooks >= 10) keys.push('ten-books');
  if (metrics.completedBooks >= 50) keys.push('fifty-books');
  if (metrics.completedChapters >= 100) keys.push('hundred-chapters');
  if (metrics.completedChapters >= 1000) keys.push('thousand-chapters');
  if (metrics.approvedReviews >= 1) keys.push('first-review');
  if (metrics.approvedReviews >= 10) keys.push('ten-reviews');
  if (metrics.savedQuotes >= 1) keys.push('first-quote');
  if (metrics.savedQuotes >= 10) keys.push('quote-collector');
  if (metrics.hasReread) keys.push('return-story');
  if (metrics.hasNightReading) keys.push('night-reader');
  if (metrics.hasWinterReading) keys.push('winter-reader');
  if (metrics.hasAutumnReading) keys.push('autumn-reader');
  if (metrics.profileAgeDays >= 365) keys.push('one-year');
  if (metrics.genreCount >= 5) keys.push('genre-explorer');
  if (metrics.confirmedErrors >= 5) keys.push('sharp-reader');
  return unique(keys);
}

function compactPublicId() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
}

function levelNotification(db, visitorKey, eventKey, title, body, createdAt) {
  return db.prepare(
    `INSERT OR IGNORE INTO reader_notifications
     (id, visitor_key, event_key, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, hidden_at, created_at)
     VALUES (?, ?, ?, 'reader_level', NULL, NULL, NULL, '', ?, ?, '/profile#reader-level', NULL, NULL, ?)`
  ).bind(`${visitorKey}:${eventKey}`, visitorKey, eventKey, title, body, createdAt);
}

async function loadReaderEvidence(db, visitorKey, allowLegacyLibrary) {
  const currentMonth = monthKey();
  const [oldStats, oldMonth, sessions, dates, books, reviews, errors, profile, publicNotes, adjustments, existingAchievements, readingFlags] = await Promise.all([
    db.prepare(`SELECT * FROM reader_level_stats WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first(),
    db.prepare(`SELECT * FROM reader_monthly_stats WHERE visitor_key = ? AND month_key = ? LIMIT 1`).bind(visitorKey, currentMonth).first(),
    db.prepare(
      `SELECT chapter_id, book_id, MIN(updated_at) AS completed_at, COUNT(DISTINCT reading_date) AS reading_dates
       FROM reading_sessions WHERE visitor_key = ? AND completed = 1
       GROUP BY chapter_id, book_id`
    ).bind(visitorKey).all(),
    db.prepare(
      `SELECT reading_date FROM reading_sessions
       WHERE visitor_key = ? AND (seconds > 0 OR max_progress >= 25)
       GROUP BY reading_date ORDER BY reading_date`
    ).bind(visitorKey).all(),
    db.prepare(
      `SELECT b.id, b.status, b.series_title, b.genres,
              COUNT(c.id) AS published_chapters,
              COUNT(DISTINCT done.chapter_id) AS completed_chapters,
              MAX(done.completed_at) AS completed_at,
              MAX(CASE WHEN rl.status IN ('finished','favorite') OR rl.progress >= 100 THEN 1 ELSE 0 END) AS legacy_completed
       FROM books b
       JOIN chapters c ON c.book_id = b.id AND c.status = 'published'
       LEFT JOIN (
         SELECT chapter_id, book_id, MIN(updated_at) AS completed_at
         FROM reading_sessions WHERE visitor_key = ? AND completed = 1
         GROUP BY chapter_id, book_id
       ) done ON done.chapter_id = c.id AND done.book_id = b.id
       LEFT JOIN reader_library rl ON rl.visitor_key = ? AND rl.book_id = b.id
       WHERE b.published = 1
       GROUP BY b.id, b.series_title, b.genres`
    ).bind(visitorKey, visitorKey).all(),
    db.prepare(`SELECT id, book_id, created_at FROM book_reviews WHERE voter_key = ? AND status = 'approved' AND length(trim(body)) >= 40`).bind(visitorKey).all(),
    db.prepare(`SELECT MIN(id) AS id, MAX(updated_at) AS updated_at FROM reader_error_reports WHERE visitor_key = ? AND status = 'resolved' GROUP BY chapter_id, paragraph_index, lower(trim(selected_text))`).bind(visitorKey).all(),
    db.prepare(`SELECT display_name, favorite_quotes, created_at FROM reader_profiles WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first(),
    db.prepare(`SELECT id, created_at FROM reader_public_notes WHERE visitor_key = ? AND status = 'approved'`).bind(visitorKey).all(),
    db.prepare(`SELECT delta, created_at FROM reader_xp_adjustments WHERE visitor_key = ?`).bind(visitorKey).all(),
    db.prepare(`SELECT achievement_key FROM reader_achievements WHERE visitor_key = ?`).bind(visitorKey).all(),
    db.prepare(
      `SELECT
         MAX(CASE WHEN CAST(strftime('%H', updated_at, '+5 hours') AS INTEGER) >= 23 OR CAST(strftime('%H', updated_at, '+5 hours') AS INTEGER) <= 4 THEN 1 ELSE 0 END) AS night,
         MAX(CASE WHEN strftime('%m', reading_date) IN ('12','01','02') THEN 1 ELSE 0 END) AS winter,
         MAX(CASE WHEN strftime('%m', reading_date) IN ('09','10','11') THEN 1 ELSE 0 END) AS autumn
       FROM reading_sessions WHERE visitor_key = ? AND (seconds > 0 OR max_progress >= 25)`
    ).bind(visitorKey).first(),
  ]);

  const sessionRows = sessions.results || [];
  const dateRows = dates.results || [];
  const bookRows = (books.results || []).map((row) => ({
    ...row,
    is_completed: row.status === 'Завершено' && ((Number(row.published_chapters || 0) > 0 && Number(row.completed_chapters || 0) >= Number(row.published_chapters || 0))
      || (allowLegacyLibrary && Boolean(row.legacy_completed))),
  }));
  return {
    oldStats,
    oldMonth,
    sessionRows,
    dateRows,
    bookRows,
    reviews: reviews.results || [],
    errors: errors.results || [],
    profile,
    publicNotes: publicNotes.results || [],
    adjustments: adjustments.results || [],
    existingAchievements: new Set((existingAchievements.results || []).map((row) => row.achievement_key)),
    readingFlags,
  };
}

export async function refreshReaderLevel({ db, visitorKey, legacyBackfill = false, suppressNotifications = false } = {}) {
  const key = normalizeReaderKey(visitorKey);
  if (!db || !key) return null;
  const config = await readReaderLevelConfig(db);
  const now = new Date();
  const nowIso = now.toISOString();
  const currentMonth = monthKey(now);
  const evidence = await loadReaderEvidence(db, key, legacyBackfill);
  const completedBookRows = evidence.bookRows.filter((row) => row.is_completed);
  const previousBookKeys = safeList(evidence.oldStats?.completed_book_keys);
  const completedBookKeys = unique([...previousBookKeys, ...completedBookRows.map((row) => row.id)]);
  const qualifyingReviews = evidence.reviews.filter((row) => completedBookKeys.includes(row.book_id));
  const currentSeries = completedSeriesFromBooks(evidence.bookRows);
  const completedSeriesKeys = unique([...safeList(evidence.oldStats?.completed_series_keys), ...currentSeries.map((item) => item.key)]);
  const readingBonuses = readingWeekBonuses(evidence.dateRows);
  const favoriteQuotes = safeList(evidence.profile?.favorite_quotes);
  const savedQuotes = Math.max(favoriteQuotes.length, evidence.publicNotes.length);
  const genreKeys = unique(completedBookRows.flatMap((row) => safeList(row.genres)).map((item) => item.toLocaleLowerCase('ru-RU')));
  const manualXp = evidence.adjustments.reduce((sum, item) => sum + Number(item.delta || 0), 0);
  const computedXp = Math.max(0,
    evidence.sessionRows.length * config.xp.chapter
    + completedBookKeys.length * config.xp.book
    + completedSeriesKeys.length * config.xp.series
    + qualifyingReviews.length * config.xp.review
    + evidence.errors.length * config.xp.confirmedError
    + readingBonuses.length * config.xp.threeReadingDays
    + manualXp
  );
  const oldLevel = Math.max(1, Number(evidence.oldStats?.level || 1));
  const levelFloor = xpForLevel(oldLevel, config.levelCurve);
  const totalXp = Math.max(levelFloor, computedXp);
  const calculatedLevel = levelForXp(totalXp, config.levelCurve);
  const level = Math.max(oldLevel, calculatedLevel);
  const rank = rankForLevel(level, config.ranks);
  const oldRank = rankForLevel(oldLevel, config.ranks);
  const monthSessions = evidence.sessionRows.filter((row) => String(row.completed_at || '').slice(0, 7) === currentMonth);
  const monthBooks = completedBookRows.filter((row) => String(row.completed_at || '').slice(0, 7) === currentMonth);
  const monthSeries = currentSeries.filter((item) => String(item.completedAt || '').slice(0, 7) === currentMonth);
  const monthReviews = qualifyingReviews.filter((row) => String(row.created_at || '').slice(0, 7) === currentMonth);
  const monthErrors = evidence.errors.filter((row) => String(row.updated_at || '').slice(0, 7) === currentMonth);
  const monthDates = evidence.dateRows.filter((row) => String(row.reading_date || '').slice(0, 7) === currentMonth);
  const monthBonuses = readingBonuses.filter((date) => String(date).slice(0, 7) === currentMonth);
  const monthAdjustments = evidence.adjustments.filter((row) => String(row.created_at || '').slice(0, 7) === currentMonth)
    .reduce((sum, row) => sum + Number(row.delta || 0), 0);
  const monthXp = Math.max(0,
    monthSessions.length * config.xp.chapter
    + monthBooks.length * config.xp.book
    + monthSeries.length * config.xp.series
    + monthReviews.length * config.xp.review
    + monthErrors.length * config.xp.confirmedError
    + monthBonuses.length * config.xp.threeReadingDays
    + monthAdjustments
  );
  const monthGenreCount = unique(monthBooks.flatMap((row) => safeList(row.genres)).map((item) => item.toLocaleLowerCase('ru-RU'))).length;
  const monthQuotes = evidence.publicNotes.filter((row) => String(row.created_at || '').slice(0, 7) === currentMonth).length;
  const profileCreated = new Date(evidence.profile?.created_at || nowIso);
  const metrics = {
    completedChapters: evidence.sessionRows.length,
    completedBooks: completedBookKeys.length,
    completedSeries: completedSeriesKeys.length,
    approvedReviews: qualifyingReviews.length,
    confirmedErrors: evidence.errors.length,
    savedQuotes,
    genreCount: genreKeys.length,
    hasReread: evidence.sessionRows.some((row) => Number(row.reading_dates || 0) > 1),
    hasNightReading: Boolean(evidence.readingFlags?.night),
    hasWinterReading: Boolean(evidence.readingFlags?.winter),
    hasAutumnReading: Boolean(evidence.readingFlags?.autumn),
    profileAgeDays: Math.max(0, Math.floor((now - profileCreated) / 86400000)),
  };
  const unlockedKeys = achievementKeys(metrics);
  const newAchievementKeys = unlockedKeys.filter((achievement) => !evidence.existingAchievements.has(achievement));
  const publicId = String(evidence.oldStats?.public_id || '').trim() || compactPublicId();
  const levelChanged = level > oldLevel;
  const rankChanged = oldRank.key !== rank.key;
  const firstCountedAt = evidence.oldStats?.first_counted_at || evidence.sessionRows.map((row) => row.completed_at).filter(Boolean).sort()[0] || nowIso;
  const reachedXpAt = monthXp === Number(evidence.oldMonth?.xp ?? -1) ? evidence.oldMonth?.reached_xp_at || nowIso : nowIso;
  const baseLevel = levelForXp(Math.max(0, totalXp - monthXp), config.levelCurve);
  const statements = [
    db.prepare(
      `INSERT OR IGNORE INTO reader_profiles (visitor_key, display_name, created_at, updated_at)
       VALUES (?, 'Читатель BOOKNERD', ?, ?)`
    ).bind(key, nowIso, nowIso),
    db.prepare(
      `INSERT INTO reader_level_stats
       (visitor_key, public_id, total_xp, level, rank_key, completed_chapters, completed_books, completed_series,
        approved_reviews, confirmed_errors, saved_quotes, unique_reading_days, completed_book_keys, completed_series_keys,
        public_visible, online_visible, current_book_visible, planned_shelf_visible, favorite_shelf_visible, achievements_visible,
        rating_status, suspicious_reason, first_counted_at, last_counted_at, recalculated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(visitor_key) DO UPDATE SET
        total_xp = excluded.total_xp, level = MAX(reader_level_stats.level, excluded.level), rank_key = excluded.rank_key,
        completed_chapters = excluded.completed_chapters, completed_books = excluded.completed_books,
        completed_series = excluded.completed_series, approved_reviews = excluded.approved_reviews,
        confirmed_errors = excluded.confirmed_errors, saved_quotes = excluded.saved_quotes,
        unique_reading_days = excluded.unique_reading_days, completed_book_keys = excluded.completed_book_keys,
        completed_series_keys = excluded.completed_series_keys, first_counted_at = COALESCE(reader_level_stats.first_counted_at, excluded.first_counted_at),
        last_counted_at = excluded.last_counted_at, recalculated_at = excluded.recalculated_at, updated_at = excluded.updated_at`
    ).bind(
      key, publicId, totalXp, level, rank.key, metrics.completedChapters, metrics.completedBooks, metrics.completedSeries,
      metrics.approvedReviews, metrics.confirmedErrors, metrics.savedQuotes, evidence.dateRows.length,
      JSON.stringify(completedBookKeys), JSON.stringify(completedSeriesKeys),
      evidence.oldStats ? Number(evidence.oldStats.public_visible) : 1,
      evidence.oldStats ? Number(evidence.oldStats.online_visible) : 1,
      evidence.oldStats ? Number(evidence.oldStats.current_book_visible) : 1,
      evidence.oldStats ? Number(evidence.oldStats.planned_shelf_visible) : 1,
      evidence.oldStats ? Number(evidence.oldStats.favorite_shelf_visible) : 1,
      evidence.oldStats ? Number(evidence.oldStats.achievements_visible) : 1,
      evidence.oldStats?.rating_status || 'active', evidence.oldStats?.suspicious_reason || '', firstCountedAt,
      nowIso, nowIso, evidence.oldStats?.created_at || nowIso, nowIso,
    ),
    db.prepare(
      `INSERT INTO reader_monthly_stats
       (visitor_key, month_key, xp, completed_chapters, completed_books, completed_series, approved_reviews,
        confirmed_errors, unique_reading_days, genre_count, quotes_saved, level_growth, reached_xp_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(visitor_key, month_key) DO UPDATE SET
        xp = excluded.xp, completed_chapters = excluded.completed_chapters, completed_books = excluded.completed_books,
        completed_series = excluded.completed_series, approved_reviews = excluded.approved_reviews,
        confirmed_errors = excluded.confirmed_errors, unique_reading_days = excluded.unique_reading_days,
        genre_count = excluded.genre_count, quotes_saved = excluded.quotes_saved,
        level_growth = excluded.level_growth, reached_xp_at = excluded.reached_xp_at, updated_at = excluded.updated_at`
    ).bind(
      key, currentMonth, monthXp, monthSessions.length, monthBooks.length, monthSeries.length, monthReviews.length,
      monthErrors.length, monthDates.length, monthGenreCount, monthQuotes, Math.max(0, level - baseLevel), reachedXpAt, nowIso,
    ),
    ...newAchievementKeys.map((achievement) => db.prepare(
      `INSERT OR IGNORE INTO reader_achievements (visitor_key, achievement_key, unlocked_at) VALUES (?, ?, ?)`
    ).bind(key, achievement, nowIso)),
  ];
  if (!suppressNotifications && levelChanged) {
    statements.push(levelNotification(db, key, `level:${level}`, 'Новый уровень!', `Вы достигли уровня ${level} и получили ранг «${rank.name}».`, nowIso));
  }
  if (!suppressNotifications) {
    for (const achievementKey of newAchievementKeys.slice(0, 4)) {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((item) => item.key === achievementKey);
      if (achievement) statements.push(levelNotification(db, key, `achievement:${achievementKey}`, `Открыто достижение «${achievement.name}»`, achievement.description, nowIso));
    }
  }
  await db.batch(statements);
  invalidateCachedRead(`reader-rankings:${currentMonth}`);
  invalidateCachedRead('reader-rankings:all');
  return {
    publicId,
    totalXp,
    level,
    rank,
    progress: levelProgress(totalXp, level, config),
    levelChanged,
    rankChanged,
    newAchievements: newAchievementKeys.map((achievementKey) => ACHIEVEMENT_DEFINITIONS.find((item) => item.key === achievementKey)).filter(Boolean),
    metrics,
    monthly: { monthKey: currentMonth, xp: monthXp, completedChapters: monthSessions.length, completedBooks: monthBooks.length },
  };
}

export function mapLevelSummary(row, config, achievements = [], awards = []) {
  if (!row) return null;
  const level = Math.max(1, Number(row.level || 1));
  const rank = rankForLevel(level, config.ranks);
  return {
    publicId: row.public_id,
    totalXp: Number(row.total_xp || 0),
    level,
    rank,
    progress: levelProgress(Number(row.total_xp || 0), level, config),
    completedChapters: Number(row.completed_chapters || 0),
    completedBooks: Number(row.completed_books || 0),
    completedSeries: Number(row.completed_series || 0),
    approvedReviews: Number(row.approved_reviews || 0),
    confirmedErrors: Number(row.confirmed_errors || 0),
    savedQuotes: Number(row.saved_quotes || 0),
    publicVisible: Boolean(row.public_visible),
    onlineVisible: Boolean(row.online_visible),
    currentBookVisible: Boolean(row.current_book_visible),
    plannedShelfVisible: Boolean(row.planned_shelf_visible),
    favoriteShelfVisible: Boolean(row.favorite_shelf_visible),
    achievementsVisible: Boolean(row.achievements_visible),
    ratingStatus: row.rating_status || 'active',
    suspiciousReason: row.suspicious_reason || '',
    achievements,
    awards,
  };
}

export async function markReaderForReview(db, visitorKey, reason) {
  const key = normalizeReaderKey(visitorKey);
  if (!db || !key) return;
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reader_level_stats (visitor_key, public_id, rating_status, suspicious_reason, created_at, updated_at)
     VALUES (?, ?, 'review', ?, ?, ?)
     ON CONFLICT(visitor_key) DO UPDATE SET rating_status = 'review', suspicious_reason = excluded.suspicious_reason, updated_at = excluded.updated_at`
  ).bind(key, compactPublicId(), String(reason || 'Требуется проверка').slice(0, 300), now, now).run();
}

function nominationSort(nominationKey) {
  const columns = {
    'master-month': ['xp'],
    'rising-reader': ['level_growth', 'xp'],
    'genre-explorer': ['genre_count', 'xp'],
    'series-keeper': ['completed_series', 'xp'],
    'community-voice': ['approved_reviews', 'xp'],
    'sharp-editor': ['confirmed_errors', 'xp'],
    'quote-collector': ['quotes_saved', 'xp'],
  }[nominationKey] || ['xp'];
  return columns.map((column) => `${column} DESC`).join(', ');
}

export async function finalizeReaderMonth(db, targetMonth = previousMonthKey()) {
  const key = /^\d{4}-\d{2}$/.test(String(targetMonth || '')) ? String(targetMonth) : previousMonthKey();
  const existing = await db.prepare(`SELECT status FROM reader_month_finalizations WHERE month_key = ? LIMIT 1`).bind(key).first();
  if (existing?.status === 'completed') return { ok: true, monthKey: key, alreadyFinalized: true, awards: 0 };
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reader_month_finalizations (month_key, status, started_at, completed_at)
     VALUES (?, 'started', ?, NULL)
     ON CONFLICT(month_key) DO UPDATE SET status = CASE WHEN reader_month_finalizations.status = 'completed' THEN 'completed' ELSE 'started' END`
  ).bind(key, now).run();
  const config = await readReaderLevelConfig(db);
  let awards = 0;
  for (const nomination of config.nominations.filter((item) => item.enabled !== false)) {
    const order = nominationSort(nomination.key);
    const minimumColumn = order.split(' ')[0];
    const winner = await db.prepare(
      `SELECT m.visitor_key FROM reader_monthly_stats m
       JOIN reader_level_stats s ON s.visitor_key = m.visitor_key
       WHERE m.month_key = ? AND m.${minimumColumn} > 0 AND s.public_visible = 1 AND s.rating_status = 'active'
       ORDER BY m.${order.replaceAll(', ', ', m.')}, m.completed_books DESC, m.unique_reading_days DESC,
                m.completed_chapters DESC, COALESCE(m.reached_xp_at, m.updated_at) ASC LIMIT 1`
    ).bind(key).first();
    if (!winner) continue;
    const result = await db.prepare(
      `INSERT OR IGNORE INTO reader_monthly_awards (visitor_key, month_key, nomination_key, title, awarded_at, awarded_by)
       VALUES (?, ?, ?, ?, ?, 'system')`
    ).bind(winner.visitor_key, key, nomination.key, nomination.name, now).run();
    if (Number(result.meta?.changes || 0) > 0) {
      awards += 1;
      await db.prepare(
        `INSERT OR IGNORE INTO reader_notifications
         (id, visitor_key, event_key, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, hidden_at, created_at)
         VALUES (?, ?, ?, 'nomination', NULL, NULL, NULL, '', 'Новая награда!', ?, '/ranking?tab=mine', NULL, NULL, ?)`
      ).bind(`${winner.visitor_key}:nomination:${key}:${nomination.key}`, winner.visitor_key, `nomination:${key}:${nomination.key}`, `В этом месяце Вы стали «${nomination.name}».`, now).run();
    }
  }
  await db.prepare(`UPDATE reader_month_finalizations SET status = 'completed', completed_at = ? WHERE month_key = ?`).bind(now, key).run();
  return { ok: true, monthKey: key, alreadyFinalized: false, awards };
}
