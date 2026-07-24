import { ensureDb, getDb } from './runtime.js';
import { sampleBooks, sampleChapters } from './sample-library.js';
import { notifyBookPreferenceEvent, notifyPublishedChapter } from './push-notifications.js';

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
    originalTitle: row.original_title || '',
    seriesTitle: row.series_title || '',
    seriesNumber: row.series_number == null ? null : Number(row.series_number),
    seriesReadingOrder: normalizeSeriesOrder(row.series_reading_order),
    releaseDays: parseList(row.release_days).length ? parseList(row.release_days) : defaultReleaseDays(row.title),
    author: row.author,
    dedication: row.dedication || '',
    triggerWarnings: parseList(row.trigger_warnings),
    hasHotScenes: Boolean(row.has_hot_scenes),
    hotSceneChapters: row.hot_scene_chapters || '',
    synopsis: row.synopsis || '',
    genres: parseList(row.genres),
    genre: parseList(row.genres)[0] || 'Другое',
    tropes: parseList(row.tropes),
    driveUrl: row.drive_url || '',
    status: row.status,
    progress: Number(row.progress || 0),
    coverKey: row.cover_key || null,
    coverUrl: row.cover_key ? `/api/covers/${row.cover_key.split('/').map(encodeURIComponent).join('/')}` : null,
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
    status: row.status,
    workflowStatus: row.workflow_status || (row.status === 'published' ? 'published' : 'draft'),
    scheduledAt: row.scheduled_at || null,
    lastEditedBy: row.last_edited_by || '',
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
  return ids;
}

export async function listPublicBooks() {
  const db = getDb();
  if (!db) return sampleBooks;
  await publishDueChapters();
  const readyDb = await ensureDb();
  const result = await readyDb.prepare(
    `SELECT * FROM books WHERE published = 1 ORDER BY updated_at DESC`
  ).all();
  return (result.results || []).map(mapBook);
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

export async function listChapters(bookId, includeDraft = false) {
  const db = getDb();
  if (!db) {
    return sampleChapters.filter((chapter) => chapter.bookId === bookId && (includeDraft || chapter.status === 'published'));
  }
  if (!includeDraft) await publishDueChapters();
  const readyDb = await ensureDb();
  const result = await readyDb.prepare(
    `SELECT * FROM chapters WHERE book_id = ? ${includeDraft ? '' : "AND status = 'published'"}
     ORDER BY chapter_number ASC`
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
    `SELECT * FROM chapters WHERE id = ? ${includeDraft ? '' : "AND status = 'published'"} LIMIT 1`
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
