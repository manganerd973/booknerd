import { authorizeAdminRequest } from '../../../../../../../lib/admin-auth.js';
import { recalculateBookProgress } from '../../../../../../../lib/books.js';
import { notifyBookPreferenceEvent } from '../../../../../../../lib/push-notifications.js';
import { createChapterReaderNotifications } from '../../../../../../../lib/reader-notifications.js';
import { ensureDb } from '../../../../../../../lib/runtime.js';

const STATEMENTS_PER_CHAPTER = 3;
const CHAPTERS_PER_BATCH = Math.floor(90 / STATEMENTS_PER_CHAPTER);

function pluralizedChapterCount(count) {
  const value = Math.abs(Number(count || 0));
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${value} глав`;
  if (last === 1) return `${value} глава`;
  if (last >= 2 && last <= 4) return `${value} главы`;
  return `${value} глав`;
}

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;

  try {
    const { id: bookId } = await params;
    const db = await ensureDb();
    const book = await db.prepare(
      `SELECT id, slug, title, published FROM books WHERE id = ? LIMIT 1`
    ).bind(bookId).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });

    const result = await db.prepare(
      `SELECT * FROM chapters
       WHERE book_id = ? AND status != 'published'
       ORDER BY chapter_number ASC, created_at ASC, id ASC`
    ).bind(bookId).all();
    const chapters = result.results || [];
    if (!chapters.length) {
      const progressState = await recalculateBookProgress(bookId, db);
      return Response.json({ publishedCount: 0, alreadyPublished: true, ...progressState });
    }

    const now = new Date().toISOString();
    const editor = auth.email || auth.displayName || '';
    for (let offset = 0; offset < chapters.length; offset += CHAPTERS_PER_BATCH) {
      const statements = chapters.slice(offset, offset + CHAPTERS_PER_BATCH).flatMap((chapter) => [
        db.prepare(
          `INSERT INTO chapter_versions
           (id, chapter_id, title, point_of_view, body, body_rich, footnotes, team_note, workflow_status, scheduled_at, saved_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), chapter.id, chapter.title, chapter.point_of_view || '', chapter.body || '', chapter.body_rich || '',
          chapter.footnotes || '[]', chapter.team_note || '', chapter.workflow_status || 'draft', chapter.scheduled_at || null, editor, now,
        ),
        db.prepare(
          `UPDATE chapters
           SET status = 'published', workflow_status = 'published', scheduled_at = NULL,
               published_at = COALESCE(published_at, ?), last_edited_by = ?, updated_at = ?
           WHERE id = ? AND status != 'published'`
        ).bind(now, editor, now, chapter.id),
        db.prepare(
          `INSERT INTO chapter_audit (id, chapter_id, action, from_status, to_status, editor_email, created_at)
           VALUES (?, ?, 'published all at once', ?, 'published', ?, ?)`
        ).bind(crypto.randomUUID(), chapter.id, chapter.workflow_status || 'draft', editor, now),
      ]);
      await db.batch(statements);
    }

    let inboxCreated = 0;
    for (const chapter of chapters) {
      inboxCreated += await createChapterReaderNotifications({ db, chapterId: chapter.id }).catch(() => 0);
    }

    const announcementStatements = chapters.map((chapter) => db.prepare(
      `INSERT OR IGNORE INTO push_announcements (chapter_id, sent_at) VALUES (?, ?)`
    ).bind(chapter.id, now));
    for (let offset = 0; offset < announcementStatements.length; offset += 90) {
      await db.batch(announcementStatements.slice(offset, offset + 90));
    }

    const firstChapter = chapters[0];
    const pushResult = await notifyBookPreferenceEvent({
      bookId,
      preference: 'newChapter',
      title: `Новые главы: ${book.title}`,
      body: chapters.length === 1
        ? (firstChapter.title || `Глава ${firstChapter.chapter_number}`)
        : `Опубликовано сразу ${pluralizedChapterCount(chapters.length)}.`,
      url: `/books/${book.slug}/chapters/${firstChapter.id}?notification=1`,
      topic: `bulk-chapters-${bookId.slice(0, 18)}-${Date.parse(now)}`,
      requestUrl: request.url,
    }).catch(() => ({ sent: 0 }));

    const progressState = await recalculateBookProgress(bookId, db);
    return Response.json({
      publishedCount: chapters.length,
      chapterIds: chapters.map((chapter) => chapter.id),
      inboxCreated,
      pushSent: Number(pushResult.sent || 0),
      ...progressState,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось опубликовать все главы.' }, { status: 500 });
  }
}
