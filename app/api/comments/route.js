import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';
import { notifyBookPreferenceEvent } from '../../../lib/push-notifications.js';

function mapComment(row) {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    authorName: row.author_name,
    body: row.body,
    isSpoiler: Boolean(row.is_spoiler),
    createdAt: row.created_at,
    upVotes: Number(row.up_votes || 0),
    downVotes: Number(row.down_votes || 0),
    score: Number(row.up_votes || 0) - Number(row.down_votes || 0),
  };
}

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

export async function GET(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const bookId = String(url.searchParams.get('bookId') || '').trim();
    const chapterId = String(url.searchParams.get('chapterId') || '').trim();
    if (!bookId) return Response.json({ error: 'Книга не указана.' }, { status: 400 });

    const db = await ensureDb();
    const statement = chapterId
      ? db.prepare(`SELECT c.id, c.parent_id, c.author_name, c.body, c.is_spoiler, c.created_at,
          SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END) AS up_votes,
          SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END) AS down_votes
          FROM comments c LEFT JOIN comment_votes v ON v.comment_id = c.id
          WHERE c.book_id = ? AND c.chapter_id = ? AND c.status = 'approved'
          GROUP BY c.id ORDER BY c.created_at ASC LIMIT 100`).bind(bookId, chapterId)
      : db.prepare(`SELECT c.id, c.parent_id, c.author_name, c.body, c.is_spoiler, c.created_at,
          SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END) AS up_votes,
          SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END) AS down_votes
          FROM comments c LEFT JOIN comment_votes v ON v.comment_id = c.id
          WHERE c.book_id = ? AND c.chapter_id IS NULL AND c.status = 'approved'
          GROUP BY c.id ORDER BY c.created_at ASC LIMIT 100`).bind(bookId);
    const result = await statement.all();
    return Response.json({ comments: (result.results || []).map(mapComment) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить комментарии.' }, { status: 503 });
  }
}

export async function POST(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const payload = await request.json();
    const bookId = String(payload.bookId || '').trim();
    const chapterId = String(payload.chapterId || '').trim() || null;
    const parentId = String(payload.parentId || '').trim() || null;
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const authorName = String(payload.authorName || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const body = String(payload.body || '').trim().slice(0, 2000);
    const isSpoiler = payload.isSpoiler === true;
    if (payload.website) return Response.json({ ok: true }, { status: 201 });
    if (!bookId || !visitorKey || authorName.length < 2 || body.length < 3) {
      return Response.json({ error: 'Укажите имя и напишите комментарий.' }, { status: 400 });
    }

    const db = await ensureDb();
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? AND published = 1 LIMIT 1`).bind(bookId).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    if (chapterId) {
      const chapter = await db.prepare(`SELECT id FROM chapters WHERE id = ? AND book_id = ? AND status = 'published' LIMIT 1`).bind(chapterId, bookId).first();
      if (!chapter) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    }
    const parent = parentId
      ? await db.prepare(
        `SELECT id, visitor_key FROM comments
         WHERE id = ? AND book_id = ? AND COALESCE(chapter_id, '') = COALESCE(?, '') AND status = 'approved'
         LIMIT 1`
      ).bind(parentId, bookId, chapterId).first()
      : null;
    if (parentId && !parent) return Response.json({ error: 'Комментарий для ответа не найден.' }, { status: 404 });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO comments (id, book_id, chapter_id, parent_id, visitor_key, author_name, body, is_spoiler, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`
    ).bind(id, bookId, chapterId, parent?.id || null, visitorKey, authorName, body, isSpoiler ? 1 : 0, now, now).run();
    if (parent?.visitor_key && parent.visitor_key !== visitorKey) {
      const bookRow = await db.prepare(`SELECT slug, title FROM books WHERE id = ? LIMIT 1`).bind(bookId).first();
      await notifyBookPreferenceEvent({
        bookId,
        preference: 'commentReply',
        title: 'Вам ответили в BOOKNERD ✦',
        body: `${authorName} ответил(а) на ваш комментарий к «${bookRow?.title || 'книге'}».`,
        url: chapterId ? `/books/${bookRow?.slug}/chapters/${chapterId}#chapter-comments` : `/books/${bookRow?.slug}#comments-${bookId}`,
        topic: `reply-${id.slice(0, 18)}`,
        requestUrl: request.url,
        targetVisitorKey: parent.visitor_key,
      }).catch(() => {});
    }
    return Response.json({ ok: true, id, moderation: 'approved' }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось отправить комментарий.' }, { status: 500 });
  }
}
