import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { listChapters } from '../../../../../../lib/books.js';
import { ensureDb } from '../../../../../../lib/runtime.js';
import { normalizeGoogleDriveUrl } from '../../../../../../lib/google-drive.js';
import { normalizeRichDocument, richDocumentToPlainText, serializeRichDocument } from '../../../../../../lib/rich-document.js';
import { notifyPublishedChapter } from '../../../../../../lib/push-notifications.js';

function normalizeChapter(payload = {}) {
  const status = payload.status === 'published' ? 'published' : 'draft';
  const driveUrl = normalizeGoogleDriveUrl(payload.driveUrl);
  const richDocument = normalizeRichDocument(payload.bodyRich);
  const richBody = richDocument.blocks.length ? richDocumentToPlainText(richDocument) : '';
  return {
    chapterNumber: Math.max(1, Math.floor(Number(payload.chapterNumber || 1))),
    title: String(payload.title || '').trim().slice(0, 220),
    body: (richBody || String(payload.body || '')).trim().slice(0, 300000),
    bodyRich: richDocument.blocks.length ? serializeRichDocument(richDocument) : '',
    heatLevel: Math.max(0, Math.min(3, Math.floor(Number(payload.heatLevel || 0)))),
    driveUrl,
    status,
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

export async function GET(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    return Response.json({ chapters: await listChapters(id, true) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
}

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const input = await request.json();
    const payload = normalizeChapter(input);
    const footnotes = normalizeFootnotes(input.footnotes);
    if (!payload.title) return Response.json({ error: 'Укажите название главы.' }, { status: 400 });
    if (payload.driveUrl === null) return Response.json({ error: 'Вставьте ссылку с drive.google.com или docs.google.com.' }, { status: 400 });
    const db = await ensureDb();
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? LIMIT 1`).bind(bookId).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO chapters
       (id, book_id, chapter_number, title, body, body_rich, footnotes, heat_level, drive_url, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, bookId, payload.chapterNumber, payload.title, payload.body, payload.bodyRich, JSON.stringify(footnotes), payload.heatLevel, payload.driveUrl, payload.status,
      payload.status === 'published' ? now : null, now, now,
    ).run();
    if (payload.status === 'published') {
      await notifyPublishedChapter({ chapterId: id, requestUrl: request.url }).catch(() => {});
    }
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    const message = String(error.message || 'Не удалось добавить главу.');
    const status = message.includes('UNIQUE') ? 409 : 500;
    return Response.json({ error: status === 409 ? 'Глава с таким номером уже существует.' : message }, { status });
  }
}
