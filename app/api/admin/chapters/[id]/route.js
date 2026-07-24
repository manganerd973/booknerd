import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';
import { normalizeGoogleDriveUrl } from '../../../../../lib/google-drive.js';
import { normalizeRichDocument, richDocumentToPlainText, serializeRichDocument } from '../../../../../lib/rich-document.js';
import { notifyBookPreferenceEvent, notifyPublishedChapter } from '../../../../../lib/push-notifications.js';

const WORKFLOW_STATUSES = new Set(['draft', 'translating', 'editing', 'proofreading', 'ready', 'scheduled', 'published']);

function normalizeChapter(payload = {}) {
  const driveUrl = normalizeGoogleDriveUrl(payload.driveUrl);
  const richDocument = normalizeRichDocument(payload.bodyRich);
  const richBody = richDocument.blocks.length ? richDocumentToPlainText(richDocument) : '';
  const chapterNumber = Math.max(1, Math.floor(Number(payload.chapterNumber || 1)));
  const workflowStatus = WORKFLOW_STATUSES.has(payload.workflowStatus)
    ? payload.workflowStatus
    : payload.status === 'published' ? 'published' : 'draft';
  return {
    chapterNumber,
    title: String(payload.title || '').trim().slice(0, 220),
    pointOfView: String(payload.pointOfView || '').trim().slice(0, 140),
    body: (richBody || String(payload.body || '')).trim().slice(0, 300000),
    bodyRich: richDocument.blocks.length ? serializeRichDocument(richDocument) : '',
    heatLevel: Math.max(0, Math.min(3, Math.floor(Number(payload.heatLevel || 0)))),
    heatPages: String(payload.heatPages || '').trim().slice(0, 80),
    teamNote: String(payload.teamNote || '').trim().slice(0, 4000),
    driveUrl,
    status: workflowStatus === 'published' ? 'published' : 'draft',
    workflowStatus,
    scheduledAt: workflowStatus === 'scheduled' && payload.scheduledAt
      ? new Date(payload.scheduledAt).toISOString()
      : null,
  };
}

function normalizeFootnotes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 200).map((footnote) => ({
    id: String(footnote?.id || crypto.randomUUID()).slice(0, 100),
    term: String(footnote?.term || '').trim().slice(0, 120),
    explanation: String(footnote?.explanation || '').trim().slice(0, 2000),
  })).filter((footnote) => {
    const key = footnote.term.toLocaleLowerCase('ru-RU');
    if (!footnote.term || !footnote.explanation || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function PUT(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const input = await request.json();
    const payload = normalizeChapter(input);
    if (!payload.title) return Response.json({ error: 'Введите название главы вручную.' }, { status: 400 });
    if (payload.driveUrl === null) return Response.json({ error: 'Вставьте ссылку с drive.google.com или docs.google.com.' }, { status: 400 });
    const db = await ensureDb();
    const current = await db.prepare(
      `SELECT c.*, b.slug AS book_slug FROM chapters c JOIN books b ON b.id = c.book_id WHERE c.id = ? LIMIT 1`
    ).bind(id).first();
    if (!current) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    const now = new Date().toISOString();
    const publishedAt = payload.status === 'published'
      ? (current.status === 'published' ? undefined : now)
      : null;
    const publishedExpression = publishedAt === undefined ? 'published_at' : '?';
    const footnotes = JSON.stringify(normalizeFootnotes(input.footnotes));
    await db.prepare(
      `INSERT INTO chapter_versions
       (id, chapter_id, title, point_of_view, body, body_rich, footnotes, team_note, workflow_status, scheduled_at, saved_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), id, current.title, current.point_of_view || '', current.body || '', current.body_rich || '',
      current.footnotes || '[]', current.team_note || '', current.workflow_status || (current.status === 'published' ? 'published' : 'draft'),
      current.scheduled_at || null, auth.email || auth.displayName || '', now,
    ).run();
    const statement = db.prepare(
      `UPDATE chapters SET chapter_number = ?, title = ?, point_of_view = ?, body = ?, body_rich = ?, footnotes = ?, heat_level = ?, heat_pages = ?, team_note = ?, drive_url = ?, status = ?,
       workflow_status = ?, scheduled_at = ?, last_edited_by = ?, published_at = ${publishedExpression}, updated_at = ? WHERE id = ?`
    );
    if (publishedAt === undefined) {
      await statement.bind(payload.chapterNumber, payload.title, payload.pointOfView, payload.body, payload.bodyRich, footnotes, payload.heatLevel, payload.heatPages, payload.teamNote, payload.driveUrl, payload.status, payload.workflowStatus, payload.scheduledAt, auth.email || auth.displayName || '', now, id).run();
    } else {
      await statement.bind(payload.chapterNumber, payload.title, payload.pointOfView, payload.body, payload.bodyRich, footnotes, payload.heatLevel, payload.heatPages, payload.teamNote, payload.driveUrl, payload.status, payload.workflowStatus, payload.scheduledAt, auth.email || auth.displayName || '', publishedAt, now, id).run();
    }
    await db.prepare(
      `INSERT INTO chapter_audit (id, chapter_id, action, from_status, to_status, editor_email, created_at)
       VALUES (?, ?, 'updated', ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), id,
      current.workflow_status || (current.status === 'published' ? 'published' : 'draft'),
      payload.workflowStatus, auth.email || auth.displayName || '', now,
    ).run();
    if (current.status !== 'published' && payload.status === 'published') {
      await notifyPublishedChapter({ chapterId: id, requestUrl: request.url }).catch(() => {});
    }
    if (payload.status === 'published' && payload.teamNote && payload.teamNote !== (current.team_note || '')) {
      await notifyBookPreferenceEvent({
        bookId: current.book_id,
        preference: 'teamNews',
        title: 'Заметка команды BOOKNERD ✦',
        body: `К главе ${payload.chapterNumber} добавлена новая заметка команды.`,
        url: `/books/${current.book_slug}/chapters/${id}`,
        topic: `team-${id.slice(0, 18)}`,
        requestUrl: request.url,
      }).catch(() => {});
    }
    return Response.json({ id });
  } catch (error) {
    const message = String(error.message || 'Не удалось сохранить главу.');
    const status = message.includes('UNIQUE') ? 409 : 500;
    return Response.json({ error: status === 409 ? 'Глава с таким номером уже существует.' : message }, { status });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const db = await ensureDb();
    const chapter = await db.prepare(
      `SELECT id, book_id FROM chapters WHERE id = ? LIMIT 1`
    ).bind(id).first();
    if (!chapter) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });

    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`DELETE FROM chapters WHERE id = ?`).bind(id),
      // Temporarily move every remaining chapter to a negative number. This
      // keeps the unique book/number index conflict-free while compacting gaps.
      db.prepare(
        `UPDATE chapters
         SET chapter_number = -ABS(chapter_number)
         WHERE book_id = ?`
      ).bind(chapter.book_id),
      db.prepare(
        `WITH ranked AS (
           SELECT
             id,
             ABS(chapter_number) AS previous_number,
             ROW_NUMBER() OVER (
               ORDER BY chapter_number DESC, created_at ASC, id ASC
             ) AS next_number
           FROM chapters
           WHERE book_id = ?
         )
         UPDATE chapters
         SET
           title = CASE
             WHEN trim(title) = 'Глава ' || (
               SELECT previous_number FROM ranked WHERE ranked.id = chapters.id
             )
             THEN 'Глава ' || (
               SELECT next_number FROM ranked WHERE ranked.id = chapters.id
             )
             WHEN substr(
               trim(title),
               1,
               length('Глава ' || (
                 SELECT previous_number FROM ranked WHERE ranked.id = chapters.id
               ))
             ) = 'Глава ' || (
               SELECT previous_number FROM ranked WHERE ranked.id = chapters.id
             )
             AND substr(
               trim(title),
               length('Глава ' || (
                 SELECT previous_number FROM ranked WHERE ranked.id = chapters.id
               )) + 1,
               1
             ) IN ('.', ':', '-', '–', '—', ' ')
             THEN 'Глава ' || (
               SELECT next_number FROM ranked WHERE ranked.id = chapters.id
             ) || substr(
               trim(title),
               length('Глава ' || (
                 SELECT previous_number FROM ranked WHERE ranked.id = chapters.id
               )) + 1
             )
             ELSE title
           END,
           chapter_number = (
             SELECT next_number FROM ranked WHERE ranked.id = chapters.id
           ),
           updated_at = ?
         WHERE book_id = ?`
      ).bind(chapter.book_id, now, chapter.book_id),
      db.prepare(`UPDATE books SET updated_at = ? WHERE id = ?`).bind(now, chapter.book_id),
    ]);
    return Response.json({ ok: true, bookId: chapter.book_id });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить главу.' }, { status: 500 });
  }
}
