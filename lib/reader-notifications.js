import { ensureDb } from './runtime.js';

export const NOTIFICATION_TYPES = new Set(['new_chapter', 'comment_reply', 'comment_upvote']);

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function notificationId(visitorKey, eventKey) {
  return `${visitorKey}:${eventKey}`;
}

export async function saveReaderNotification({
  db: suppliedDb,
  visitorKey,
  eventKey,
  type,
  bookId = null,
  chapterId = null,
  commentId = null,
  actorName = '',
  title,
  body,
  url,
  createdAt = new Date().toISOString(),
}) {
  const normalizedVisitorKey = text(visitorKey, 120);
  const normalizedEventKey = text(eventKey, 180);
  if (!normalizedVisitorKey || !normalizedEventKey || !NOTIFICATION_TYPES.has(type)) return false;
  const db = suppliedDb || await ensureDb();
  const result = await db.prepare(
    `INSERT OR IGNORE INTO reader_notifications
     (id, visitor_key, event_key, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).bind(
    notificationId(normalizedVisitorKey, normalizedEventKey), normalizedVisitorKey, normalizedEventKey, type,
    bookId || null, chapterId || null, commentId || null, text(actorName, 80), text(title, 180),
    text(body, 600), text(url, 500), createdAt,
  ).run();
  return Number(result.meta?.changes || 0) > 0;
}

export async function removeReaderNotification({ db: suppliedDb, visitorKey, eventKey }) {
  const db = suppliedDb || await ensureDb();
  await db.prepare(`DELETE FROM reader_notifications WHERE visitor_key = ? AND event_key = ?`)
    .bind(text(visitorKey, 120), text(eventKey, 180)).run();
}

export async function createChapterReaderNotifications({ db: suppliedDb, chapterId }) {
  const db = suppliedDb || await ensureDb();
  const chapter = await db.prepare(
    `SELECT c.id, c.book_id, c.chapter_number, c.title AS chapter_title,
            COALESCE(c.published_at, c.updated_at, c.created_at) AS event_created_at,
            b.slug, b.title AS book_title
     FROM chapters c
     JOIN books b ON b.id = c.book_id
     WHERE c.id = ? AND c.status = 'published' AND b.published = 1
     LIMIT 1`
  ).bind(chapterId).first();
  if (!chapter) return 0;
  const result = await db.prepare(
    `INSERT OR IGNORE INTO reader_notifications
     (id, visitor_key, event_key, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, created_at)
     SELECT rl.visitor_key || ':chapter:' || ?, rl.visitor_key, 'chapter:' || ?, 'new_chapter',
            ?, ?, NULL, '', ?, ?, ?, NULL, ?
     FROM reader_library rl
     WHERE rl.book_id = ? AND rl.status = 'reading'`
  ).bind(
    chapter.id, chapter.id, chapter.book_id, chapter.id,
    `Новая глава: ${chapter.book_title}`,
    chapter.chapter_title || `Глава ${chapter.chapter_number}`,
    `/books/${chapter.slug}/chapters/${chapter.id}?notification=1`,
    chapter.event_created_at || new Date().toISOString(), chapter.book_id,
  ).run();
  return Number(result.meta?.changes || 0);
}

export async function syncReaderNotifications(visitorKey) {
  const db = await ensureDb();
  const key = text(visitorKey, 120);
  if (!key) return db;
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO reader_notifications
       (id, visitor_key, event_key, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, created_at)
       SELECT parent.visitor_key || ':reply:' || reply.id,
              parent.visitor_key, 'reply:' || reply.id, 'comment_reply', reply.book_id, reply.chapter_id, reply.id,
              reply.author_name, 'Ответ на ваш комментарий',
              CASE WHEN reply.chapter_id IS NOT NULL
                THEN reply.author_name || ' ответил(а) вам в «' || b.title || '», глава ' || COALESCE(ch.chapter_number, '') || '.'
                ELSE reply.author_name || ' ответил(а) вам в обсуждении «' || b.title || '».' END,
              CASE WHEN reply.chapter_id IS NOT NULL
                THEN '/books/' || b.slug || '/chapters/' || reply.chapter_id || '?notification=1#comment-' || reply.id
                ELSE '/books/' || b.slug || '#comment-' || reply.id END,
              NULL, reply.created_at
       FROM comments reply
       JOIN comments parent ON parent.id = reply.parent_id
       JOIN books b ON b.id = reply.book_id AND b.published = 1
       LEFT JOIN chapters ch ON ch.id = reply.chapter_id
       WHERE parent.visitor_key = ? AND reply.visitor_key <> parent.visitor_key AND reply.status = 'approved'`
    ).bind(key),
    db.prepare(
      `INSERT OR IGNORE INTO reader_notifications
       (id, visitor_key, event_key, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, created_at)
       SELECT c.visitor_key || ':comment-upvote:' || c.id || ':' || v.voter_key,
              c.visitor_key, 'comment-upvote:' || c.id || ':' || v.voter_key, 'comment_upvote',
              c.book_id, c.chapter_id, c.id, '', 'Новый плюс к комментарию',
              CASE WHEN c.chapter_id IS NOT NULL
                THEN 'Кто-то поставил плюс вашему комментарию в «' || b.title || '», глава ' || COALESCE(ch.chapter_number, '') || '.'
                ELSE 'Кто-то поставил плюс вашему комментарию в обсуждении «' || b.title || '».' END,
              CASE WHEN c.chapter_id IS NOT NULL
                THEN '/books/' || b.slug || '/chapters/' || c.chapter_id || '?notification=1#comment-' || c.id
                ELSE '/books/' || b.slug || '#comment-' || c.id END,
              NULL, v.updated_at
       FROM comment_votes v
       JOIN comments c ON c.id = v.comment_id AND c.status = 'approved'
       JOIN books b ON b.id = c.book_id AND b.published = 1
       LEFT JOIN chapters ch ON ch.id = c.chapter_id
       WHERE c.visitor_key = ? AND v.voter_key <> c.visitor_key AND v.value = 1`
    ).bind(key),
    db.prepare(
      `INSERT OR IGNORE INTO reader_notifications
       (id, visitor_key, event_key, type, book_id, chapter_id, comment_id, actor_name, title, body, url, read_at, created_at)
       SELECT rl.visitor_key || ':chapter:' || c.id,
              rl.visitor_key, 'chapter:' || c.id, 'new_chapter', b.id, c.id, NULL, '',
              'Новая глава: ' || b.title, COALESCE(NULLIF(c.title, ''), 'Глава ' || c.chapter_number),
              '/books/' || b.slug || '/chapters/' || c.id || '?notification=1', NULL,
              COALESCE(c.published_at, c.updated_at, c.created_at)
       FROM reader_library rl
       JOIN books b ON b.id = rl.book_id AND b.published = 1
       JOIN chapters c ON c.book_id = b.id AND c.status = 'published'
       LEFT JOIN chapters last_chapter ON last_chapter.id = rl.last_chapter_id
       WHERE rl.visitor_key = ? AND rl.status = 'reading'
         AND c.chapter_number > COALESCE(last_chapter.chapter_number, 0)
         AND datetime(COALESCE(c.published_at, c.updated_at, c.created_at)) >= datetime(rl.created_at)`
    ).bind(key),
  ]);
  return db;
}

export function mapReaderNotification(row) {
  const coverUrl = row.cover_key
    ? `/api/covers/${String(row.cover_key).split('/').map(encodeURIComponent).join('/')}`
    : null;
  const lastPage = Math.max(0, Number(row.last_page || 0));
  const resumeUrl = row.book_slug && row.last_chapter_id
    ? `/books/${row.book_slug}/chapters/${row.last_chapter_id}?page=${lastPage + 1}&notification=1`
    : null;
  return {
    id: row.id,
    type: row.type,
    bookId: row.book_id || null,
    chapterId: row.chapter_id || null,
    commentId: row.comment_id || null,
    actorName: row.actor_name || '',
    title: row.title,
    body: row.body,
    url: row.url,
    bookTitle: row.book_title || '',
    bookSlug: row.book_slug || '',
    coverUrl,
    chapterNumber: row.chapter_number == null ? null : Number(row.chapter_number),
    chapterTitle: row.chapter_title || '',
    lastChapterId: row.last_chapter_id || null,
    lastChapterNumber: row.last_chapter_number == null ? null : Number(row.last_chapter_number),
    lastChapterTitle: row.last_chapter_title || '',
    lastPage,
    resumeUrl,
    readAt: row.read_at || null,
    hiddenAt: row.hidden_at || null,
    createdAt: row.created_at,
  };
}
