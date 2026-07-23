import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';
import { normalizeGoogleDriveUrl } from '../../../../../lib/google-drive.js';
import { normalizeRichDocument, richDocumentToPlainText, serializeRichDocument } from '../../../../../lib/rich-document.js';
import { notifyPublishedChapter } from '../../../../../lib/push-notifications.js';

function normalizeChapter(payload = {}) {
  const driveUrl = normalizeGoogleDriveUrl(payload.driveUrl);
  const richDocument = normalizeRichDocument(payload.bodyRich);
  const richBody = richDocument.blocks.length ? richDocumentToPlainText(richDocument) : '';
  return {
    chapterNumber: Math.max(1, Math.floor(Number(payload.chapterNumber || 1))),
    title: String(payload.title || '').trim().slice(0, 220),
    pointOfView: String(payload.pointOfView || '').trim().slice(0, 140),
    body: (richBody || String(payload.body || '')).trim().slice(0, 300000),
    bodyRich: richDocument.blocks.length ? serializeRichDocument(richDocument) : '',
    heatLevel: Math.max(0, Math.min(3, Math.floor(Number(payload.heatLevel || 0)))),
    driveUrl,
    status: payload.status === 'published' ? 'published' : 'draft',
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
    if (!payload.title) return Response.json({ error: 'Укажите название главы.' }, { status: 400 });
    if (payload.driveUrl === null) return Response.json({ error: 'Вставьте ссылку с drive.google.com или docs.google.com.' }, { status: 400 });
    const db = await ensureDb();
    const current = await db.prepare(`SELECT status, footnotes FROM chapters WHERE id = ? LIMIT 1`).bind(id).first();
    if (!current) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    const now = new Date().toISOString();
    const publishedAt = payload.status === 'published'
      ? (current.status === 'published' ? undefined : now)
      : null;
    const publishedExpression = publishedAt === undefined ? 'published_at' : '?';
    const footnotes = JSON.stringify(normalizeFootnotes(input.footnotes));
    const statement = db.prepare(
      `UPDATE chapters SET chapter_number = ?, title = ?, point_of_view = ?, body = ?, body_rich = ?, footnotes = ?, heat_level = ?, drive_url = ?, status = ?,
       published_at = ${publishedExpression}, updated_at = ? WHERE id = ?`
    );
    if (publishedAt === undefined) {
      await statement.bind(payload.chapterNumber, payload.title, payload.pointOfView, payload.body, payload.bodyRich, footnotes, payload.heatLevel, payload.driveUrl, payload.status, now, id).run();
    } else {
      await statement.bind(payload.chapterNumber, payload.title, payload.pointOfView, payload.body, payload.bodyRich, footnotes, payload.heatLevel, payload.driveUrl, payload.status, publishedAt, now, id).run();
    }
    if (current.status !== 'published' && payload.status === 'published') {
      await notifyPublishedChapter({ chapterId: id, requestUrl: request.url }).catch(() => {});
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
    await (await ensureDb()).prepare(`DELETE FROM chapters WHERE id = ?`).bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить главу.' }, { status: 500 });
  }
}
