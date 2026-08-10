import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function cleanId(value) {
  return String(value || '').trim().slice(0, 120);
}

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

export async function POST(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const sourceAnnotationId = cleanId(payload.sourceAnnotationId);
    const bookId = cleanId(payload.bookId);
    const chapterId = cleanId(payload.chapterId);
    const quote = String(payload.quote || '').trim().replace(/\s+/g, ' ').slice(0, 1200);
    const note = String(payload.note || '').trim().slice(0, 2000);
    const paragraphIndex = Math.max(0, Math.floor(Number(payload.paragraphIndex || 0)));
    const page = Math.max(0, Math.floor(Number(payload.page || 0)));
    const isSpoiler = payload.isSpoiler === true;
    if (!visitorKey || !sourceAnnotationId || !bookId || !chapterId || !quote) {
      return Response.json({ error: 'Не удалось подготовить заметку.' }, { status: 400 });
    }

    const db = await ensureDb();
    const source = await db.prepare(
      `SELECT c.id FROM chapters c JOIN books b ON b.id = c.book_id
       WHERE c.id = ? AND c.book_id = ? AND c.status = 'published' AND b.published = 1 LIMIT 1`
    ).bind(chapterId, bookId).first();
    if (!source) return Response.json({ error: 'Опубликованная глава не найдена.' }, { status: 404 });

    const profile = await db.prepare(`SELECT display_name FROM reader_profiles WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first();
    const authorName = String(profile?.display_name || 'Читатель BOOKNERD').trim().replace(/\s+/g, ' ').slice(0, 60) || 'Читатель BOOKNERD';
    const now = new Date().toISOString();
    const existing = await db.prepare(
      `SELECT id, status FROM reader_public_notes WHERE visitor_key = ? AND source_annotation_id = ? LIMIT 1`
    ).bind(visitorKey, sourceAnnotationId).first();
    const id = existing?.id || crypto.randomUUID();
    await db.prepare(
      `INSERT INTO reader_public_notes
       (id, visitor_key, source_annotation_id, book_id, chapter_id, author_name, quote, note, paragraph_index, page, is_spoiler, status, is_pinned, approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)
       ON CONFLICT(visitor_key, source_annotation_id) DO UPDATE SET
         book_id = excluded.book_id, chapter_id = excluded.chapter_id, author_name = excluded.author_name,
         quote = excluded.quote, note = excluded.note, paragraph_index = excluded.paragraph_index,
         page = excluded.page, is_spoiler = excluded.is_spoiler,
         status = CASE WHEN reader_public_notes.quote != excluded.quote OR reader_public_notes.note != excluded.note OR reader_public_notes.is_spoiler != excluded.is_spoiler THEN 'pending' ELSE reader_public_notes.status END,
         is_pinned = CASE WHEN reader_public_notes.quote != excluded.quote OR reader_public_notes.note != excluded.note OR reader_public_notes.is_spoiler != excluded.is_spoiler THEN 0 ELSE reader_public_notes.is_pinned END,
         approved_at = CASE WHEN reader_public_notes.quote != excluded.quote OR reader_public_notes.note != excluded.note OR reader_public_notes.is_spoiler != excluded.is_spoiler THEN NULL ELSE reader_public_notes.approved_at END,
         updated_at = excluded.updated_at`
    ).bind(id, visitorKey, sourceAnnotationId, bookId, chapterId, authorName, quote, note, paragraphIndex, page, isSpoiler ? 1 : 0, now, now).run();

    return Response.json({ ok: true, id, status: existing?.status === 'approved' ? 'pending' : (existing?.status || 'pending') });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось отправить заметку.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const visitorKey = normalizeVisitorKey(url.searchParams.get('visitorKey'));
    const sourceAnnotationId = cleanId(url.searchParams.get('sourceAnnotationId'));
    if (!visitorKey || !sourceAnnotationId) return Response.json({ error: 'Заметка не указана.' }, { status: 400 });
    await (await ensureDb()).prepare(
      `DELETE FROM reader_public_notes WHERE visitor_key = ? AND source_annotation_id = ?`
    ).bind(visitorKey, sourceAnnotationId).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось убрать заметку.' }, { status: 500 });
  }
}
