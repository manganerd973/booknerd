import { cachedRead, invalidateCachedRead } from './read-cache.js';
import { normalizeWorkflowStatus } from './chapter-status.js';
import { ensureDb, getDb } from './runtime.js';
import { sampleBooks, sampleChapters } from './sample-library.js';
import { notifyBookPreferenceEvent, notifyPublishedChapter } from './push-notifications.js';
import { normalizeBookStatus } from './book-status.js';

function parseList(value) {
  try {
    const genres = JSON.parse(value || '[]');
    return Array.isArray(genres) ? genres.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const RELEASE_SCHEDULE_BY_TITLE = new Map([
  ['божественная империя', ['Понедельник', 'Четверг']],
  ['24690', ['Вторник', 'Суббота']],
  ['вся эта искажённая слава', ['Вторник', 'Пятница']],
  ['вся эта искаженная слава', ['Вторник', 'Пятница']],
]);

function defaultReleaseDays(title) {
  return RELEASE_SCHEDULE_BY_TITLE.get(String(title || '').trim().toLocaleLowerCase('ru-RU')) || [];
}

function normalizeSeriesOrder(value) {
  return parseList(value).slice(0, 80).map((item, index) => ({
    id: String(item?.id || `series-${index + 1}`).slice(0, 100),
    order: Math.max(1, Number(item?.order || index + 1)),
    title: String(item?.title || '').trim().slice(0, 220),
    kind: item?.kind === 'extra' ? 'extra' : 'main',
    translated: item?.translated === true,
    bookSlug: String(item?.bookSlug || '').trim().slice(0, 120),
  })).filter((item) => item.title);
}

export function mapBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    bookType: row.book_type || '',
    ageRating: row.age_rating == null ? null : Number(row.age_rating),
    hasIllustrations: Boolean(row.has_illustrations),
    originalTitle: row.original_title || '',
    seriesTitle: row.series_title || '',
    seriesNumber: row.series_number == null ? null : Number(row.series_number),
    seriesReadingOrder: normalizeSeriesOrder(row.series_reading_order),
    releaseDays: parseList(row.release_days).length ? parseList(row.release_days) : defaultReleaseDays(row.title),
    author: row.author,
    country: row.country || '',
    publicationYear: row.publication_year == null ? null : Number(row.publication_year),
    pageCount: Number(row.page_count || 0),
    plannedChapterCount: Number(row.planned_chapter_count || 0),
    authorBirthday: row.author_birthday || '',
    originalReleaseDate: row.original_release_date || '',
    translator: row.translator || '',
    editor: row.editor || '',
    proofreader: row.proofreader || '',
    playlistUrl: row.playlist_url || '',
    teamPick: Boolean(row.team_pick),
    quoteOfDay: row.quote_of_day || '',
    searchAliases: parseList(row.search_aliases),
    dedication: row.dedication || '',
    triggerWarnings: parseList(row.trigger_warnings),
    hasHotScenes: Boolean(row.has_hot_scenes),
    hotSceneChapters: row.hot_scene_chapters || '',
    synopsis: row.synopsis || '',
    genres: parseList(row.genres),
    genre: parseList(row.genres)[0] || 'Другое',
    tropes: parseList(row.tropes),
    driveUrl: row.drive_url || '',
    status: normalizeBookStatus(row.status),
    progress: Number(row.progress || 0),
    lastPublishedAt: row.last_published_at || null,
    ratingAverage: row.rating_average == null ? null : Number(row.rating_average),
    chapterCount: Number(row.chapter_count || 0),
    publishedChapterCount: Number(row.published_chapter_count || 0),
    coverKey: row.cover_key || null,
    coverUrl: row.cover_key ? `/api/covers/${row.cover_key.split('/').map(encodeURIComponent).join('/')}` : null,
    worldMapKey: row.world_map_key || null,
    worldMapName: row.world_map_name || '',
    worldMapContentType: row.world_map_content_type || '',
    worldMapSizeBytes: Number(row.world_map_size_bytes || 0),
    worldMapUrl: row.world_map_key ? `/api/books/${encodeURIComponent(row.id)}/world-map?v=${encodeURIComponent(row.world_map_key)}` : null,
    published: Boolean(row.published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChapter(row) {
  if (!row) return null;
  const footnotes = parseList(row.footnotes).map((footnote) => ({
    id: String(footnote?.id || ''),
    term: String(footnote?.term || '').trim(),
    explanation: String(footnote?.explanation || '').trim(),
  })).filter((footnote) => footnote.term && footnote.explanation);
  return {
    id: row.id,
    bookId: row.book_id,
    chapterNumber: Number(row.chapter_number),
    title: row.title,
    pointOfView: row.point_of_view || '',
    body: row.body || '',
    bodyRich: row.body_rich || '',
    footnotes,
    heatLevel: Math.max(0, Math.min(3, Number(row.heat_level || 0))),
    heatPages: row.heat_pages || '',
    teamNote: row.team_note || '',
    driveUrl: row.drive_url || '',
    musicUrl: row.music_key ? `/api/chapter-music/${encodeURIComponent(row.id)}` : null,
    musicTitle: row.music_title || '',
    musicArtist: row.music_artist || '',
    musicFileName: row.music_file_name || '',
    musicContentType: row.music_content_type || '',
    musicSizeBytes: Number(row.music_size_bytes || 0),
    status: row.status,
    workflowStatus: normalizeWorkflowStatus(row.workflow_status, row.status),
    scheduledAt: row.scheduled_at || null,
    lastEditedBy: row.last_edited_by || '',
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function recalculateBookProgress(bookId, database = null) {
  const db = database || await ensureDb();
  const summary = await db.prepare(
    `SELECT b.status, b.planned_chapter_count,
            COUNT(c.id) AS chapter_count,
            SUM(CASE WHEN c.status = 'published' THEN 1 ELSE 0 END) AS published_chapter_count
     FROM books b
     LEFT JOIN chapters c ON c.book_id = b.id
     WHERE b.id = ?
     GROUP BY b.id`
  ).bind(bookId).first();
  if (!summary) return { progress: 0, chapterCount: 0, publishedChapterCount: 0, plannedChapterCount: 0 };
  const chapterCount = Math.max(0, Number(summary.chapter_count || 0));
  const publishedChapterCount = Math.max(0, Number(summary.published_chapter_count || 0));
  const plannedChapterCount = Math.max(0, Number(summary.planned_chapter_count || 0));
  const progress = normalizeBookStatus(summary.status) === 'Завершено'
    ? 100
    : plannedChapterCount > 0
      ? Math.max(0, Math.min(100, Math.round((publishedChapterCount / plannedChapterCount) * 100)))
      : 0;
  await db.prepare(`UPDATE books SET progress = ?, updated_at = ? WHERE id = ?`)
    .bind(progress, new Date().toISOString(), bookId)
    .run();
  return { progress, chapterCount, publishedChapterCount, plannedChapterCount };
}

export async function publishDueChapters() {
  const db = getDb();
  if (!db) return [];
  const readyDb = await ensureDb();
  const now = new Date().toISOString();
  const due = await readyDb.prepare(
    `SELECT c.id, c.book_id, c.chapter_number, c.team_note, b.slug
     FROM chapters c
     JOIN books b ON b.id = c.book_id
     WHERE c.workflow_status = 'scheduled'
       AND c.scheduled_at IS NOT NULL
       AND c.scheduled_at <= ?
       AND b.published = 1
     ORDER BY c.scheduled_at ASC
     LIMIT 25`
  ).bind(now).all();
  const chapters = due.results || [];
  const ids = chapters.map((row) => row.id);
  for (const chapter of chapters) {
    const chapterId = chapter.id;
    const published = await readyDb.prepare(
      `UPDATE chapters
       SET status = 'published', workflow_status = 'published',
           published_at = COALESCE(published_at, ?),
           last_edited_by = 'BOOKNERD · автопубликация',
           updated_at = ?
       WHERE id = ? AND workflow_status = 'scheduled'`
    ).bind(now, now, chapterId).run();
    if (!Number(published.meta?.changes || 0)) continue;
    await readyDb.prepare(
      `INSERT INTO chapter_audit
       (id, chapter_id, action, from_status, to_status, editor_email, created_at)
       VALUES (?, ?, 'published automatically', 'scheduled', 'published', 'BOOKNERD · автопубликация', ?)`
    ).bind(crypto.randomUUID(), chapterId, now).run();
    await recalculateBookProgress(chapter.book_id, readyDb);
    await notifyPublishedChapter({ chapterId }).catch(() => {});
    if (chapter.team_note) {
      await notifyBookPreferenceEvent({
        bookId: chapter.book_id,
        preference: 'teamNews',
        title: 'Заметка команды BOOKNERD ✦',
        body: `К главе ${chapter.chapter_number} добавлена новая заметка команды.`,
        url: `/books/${chapter.slug}/chapters/${chapterId}`,
        topic: `team-${chapterId.slice(0, 18)}`,
      }).catch(() => {});
    }
  }
  if (ids.length) invalidateCachedRead('public-books:d1-v1');
  return ids;
}

export async function listPublicBooks() {
  const db = getDb();
  if (!db) return sampleBooks.map((book) => ({
    ...book,
    status: normalizeBookStatus(book.status),
    chapterCount: sampleChapters.filter((chapter) => chapter.bookId === book.id).length,
    publishedChapterCount: sampleChapters.filter((chapter) => chapter.bookId === book.id && chapter.status === 'published').length,
  }));
  return cachedRead('public-books:d1-v1', 30000, async () => {
  const readyDb = await ensureDb();
  const result = await readyDb.prepare(
    `SELECT b.*, EXISTS(SELECT 1 FROM book_artworks WHERE book_id = b.id) AS has_illustrations, (SELECT AVG(rating) FROM book_ratings WHERE book_id = b.id) AS rating_average, COUNT(c.id) AS chapter_count,
      MAX(CASE WHEN c.status = 'published' THEN COALESCE(c.published_at, c.created_at) END) AS last_published_at,
      SUM(CASE WHEN c.status = 'published' THEN 1 ELSE 0 END) AS published_chapter_count
     FROM books b
     LEFT JOIN chapters c ON c.book_id = b.id
     WHERE b.published = 1
     GROUP BY b.id
     ORDER BY b.updated_at DESC`
  ).all();
  return (result.results || []).map(mapBook);
  });
}

export async function listRecentPublicChapters(limit = 30) {
  const db = getDb();
  if (!db) return sampleChapters.filter((chapter) => chapter.status === 'published').slice(0, limit);
  const readyDb = await ensureDb();
  const { results } = await readyDb.prepare(
    `SELECT c.id, c.book_id, c.chapter_number, c.title, COALESCE(c.published_at, c.created_at) AS published_at
     FROM chapters c JOIN books b ON b.id = c.book_id
     WHERE c.status = 'published' AND b.published = 1
     ORDER BY COALESCE(c.published_at, c.created_at) DESC, c.id DESC
     LIMIT ?`
  ).bind(limit).all();
  return (results || []).map((row) => ({
    id: row.id,
    bookId: row.book_id,
    chapterNumber: Number(row.chapter_number),
    title: row.title,
    publishedAt: row.published_at,
  }));
}

export async function listAllBooks() {
  const db = await ensureDb();
  const result = await db.prepare(
    `SELECT b.*, COUNT(c.id) AS chapter_count,
      SUM(CASE WHEN c.status = 'published' THEN 1 ELSE 0 END) AS published_chapter_count
     FROM books b
     LEFT JOIN chapters c ON c.book_id = b.id
     GROUP BY b.id
     ORDER BY b.updated_at DESC`
  ).all();
  return (result.results || []).map((row) => ({
    ...mapBook(row),
    chapterCount: Number(row.chapter_count || 0),
    publishedChapterCount: Number(row.published_chapter_count || 0),
  }));
}

export async function getBookBySlug(slug, includeDraft = false) {
  const db = getDb();
  if (!db) return sampleBooks.find((book) => book.slug === slug) || null;
  if (!includeDraft) await publishDueChapters();
  const readyDb = await ensureDb();
  const row = await readyDb.prepare(
    `SELECT * FROM books WHERE slug = ? ${includeDraft ? '' : 'AND published = 1'} LIMIT 1`
  ).bind(slug).first();
  return mapBook(row);
}

export async function getBookById(id) {
  const db = await ensureDb();
  const row = await db.prepare(`SELECT * FROM books WHERE id = ? LIMIT 1`).bind(id).first();
  return mapBook(row);
}

export async function listSeriesBooks(seriesTitle, includeDraft = false) {
  const normalized = String(seriesTitle || '').trim();
  if (!normalized) return [];
  const db = getDb();
  if (!db) {
    return sampleBooks
      .filter((book) => book.seriesTitle === normalized && (includeDraft || book.published))
      .sort((left, right) => Number(left.seriesNumber || 999) - Number(right.seriesNumber || 999));
  }
  const readyDb = await ensureDb();
  const result = await readyDb.prepare(
    `SELECT * FROM books
     WHERE series_title = ? ${includeDraft ? '' : 'AND published = 1'}
     ORDER BY CASE WHEN series_number IS NULL THEN 1 ELSE 0 END, series_number ASC, created_at ASC`
  ).bind(normalized).all();
  return (result.results || []).map(mapBook);
}

// The book landing page needs chapter metadata, not every chapter's full text.
export async function listChapterSummaries(bookId) {
  const db = getDb();
  if (!db) return sampleChapters.filter((chapter) => chapter.bookId === bookId && chapter.status === 'published').map(({body, bodyRich, footnotes, ...chapter}) => chapter);
  const readyDb = await ensureDb();
  const result = await readyDb.prepare(`SELECT id, book_id, chapter_number, title, point_of_view,
    heat_level, heat_pages, status, workflow_status, published_at, created_at, updated_at,
    (SELECT COUNT(*) FROM chapter_likes l WHERE l.chapter_id = chapters.id) AS like_count,
    (SELECT COUNT(*) FROM comments c WHERE c.chapter_id = chapters.id AND c.status = 'approved') AS comment_count
    FROM chapters WHERE book_id = ? AND status = 'published' ORDER BY chapter_number ASC`).bind(bookId).all();
  return (result.results || []).map(row => ({ ...mapChapter(row), likeCount: Number(row.like_count || 0), commentCount: Number(row.comment_count || 0) }));
}

export async function listChapters(bookId, includeDraft = false) {
  const db = getDb();
  if (!db) {
    return sampleChapters.filter((chapter) => chapter.bookId === bookId && (includeDraft || chapter.status === 'published'));
  }
  if (!includeDraft) await publishDueChapters();
  const readyDb = await ensureDb();
  const result = await readyDb.prepare(
    `SELECT c.*,
            m.storage_key AS music_key,
            m.title AS music_title,
            m.artist AS music_artist,
            m.file_name AS music_file_name,
            m.content_type AS music_content_type,
            m.size_bytes AS music_size_bytes
     FROM chapters c
     LEFT JOIN chapter_music m ON m.chapter_id = c.id
     WHERE c.book_id = ? ${includeDraft ? '' : "AND c.status = 'published'"}
     ORDER BY c.chapter_number ASC`
  ).bind(bookId).all();
  return (result.results || []).map(mapChapter);
}

export async function getChapter(id, includeDraft = false) {
  const db = getDb();
  if (!db) {
    const chapter = sampleChapters.find((item) => item.id === id);
    return chapter && (includeDraft || chapter.status === 'published') ? chapter : null;
  }
  if (!includeDraft) await publishDueChapters();
  const readyDb = await ensureDb();
  const row = await readyDb.prepare(
    `SELECT c.*,
            m.storage_key AS music_key,
            m.title AS music_title,
            m.artist AS music_artist,
            m.file_name AS music_file_name,
            m.content_type AS music_content_type,
            m.size_bytes AS music_size_bytes
     FROM chapters c
     LEFT JOIN chapter_music m ON m.chapter_id = c.id
     WHERE c.id = ? ${includeDraft ? '' : "AND c.status = 'published'"}
     LIMIT 1`
  ).bind(id).first();
  return mapChapter(row);
}

const cyrillicMap = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ь: '', ъ: '',
};

export function slugify(value) {
  const transliterated = String(value || '').toLowerCase().split('').map((letter) => cyrillicMap[letter] ?? letter).join('');
  const slug = transliterated.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return slug || `book-${crypto.randomUUID().slice(0, 8)}`;
}
