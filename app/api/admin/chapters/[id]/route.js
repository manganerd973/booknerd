import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';
import { normalizeGoogleDriveUrl } from '../../../../../lib/google-drive.js';

function normalizeChapter(payload = {}) {
  const driveUrl = normalizeGoogleDriveUrl(payload.driveUrl);
  return {
    chapterNumber: Math.max(1, Math.floor(Number(payload.chapterNumber || 1))),
    title: String(payload.title || '').trim().slice(0, 220),
    body: String(payload.body || '').trim().slice(0, 300000),
    driveUrl,
    status: payload.status === 'published' ? 'published' : 'draft',
  };
}

export async function PUT(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const payload = normalizeChapter(await request.json());
    if (!payload.title) return Response.json({ error: 'Укажите название главы.' }, { status: 400 });
    if (payload.driveUrl === null) return Response.json({ error: 'Вставьте ссылку с drive.google.com или docs.google.com.' }, { status: 400 });
    const db = await ensureDb();
    const current = await db.prepare(`SELECT status FROM chapters WHERE id = ? LIMIT 1`).bind(id).first();
    if (!current) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    const now = new Date().toISOString();
    const publishedAt = payload.status === 'published'
      ? (current.status === 'published' ? undefined : now)
      : null;
    const publishedExpression = publishedAt === undefined ? 'published_at' : '?';
    const statement = db.prepare(
      `UPDATE chapters SET chapter_number = ?, title = ?, body = ?, drive_url = ?, status = ?,
       published_at = ${publishedExpression}, updated_at = ? WHERE id = ?`
    );
    if (publishedAt === undefined) {
      await statement.bind(payload.chapterNumber, payload.title, payload.body, payload.driveUrl, payload.status, now, id).run();
    } else {
      await statement.bind(payload.chapterNumber, payload.title, payload.body, payload.driveUrl, payload.status, publishedAt, now, id).run();
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
