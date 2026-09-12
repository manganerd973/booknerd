import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';
import { refreshReaderLevel } from '../../../../../lib/reader-levels.js';

export async function PATCH(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const payload = await request.json();
    if (!['approved', 'pending'].includes(payload.status)) {
      return Response.json({ error: 'Неизвестный статус комментария.' }, { status: 400 });
    }
    const table = payload.kind === 'review' ? 'book_reviews' : 'comments';
    const db = await ensureDb();
    const reader = payload.kind === 'review' ? await db.prepare(`SELECT voter_key FROM book_reviews WHERE id = ? LIMIT 1`).bind(id).first() : null;
    const result = await db.prepare(
      `UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(payload.status, new Date().toISOString(), id).run();
    if (!result.meta?.changes) return Response.json({ error: 'Комментарий не найден.' }, { status: 404 });
    if (reader?.voter_key) await refreshReaderLevel({ db, visitorKey: reader.voter_key, suppressNotifications: true }).catch(() => null);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось изменить комментарий.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const kind = new URL(request.url).searchParams.get('kind');
    const table = kind === 'review' ? 'book_reviews' : 'comments';
    const db = await ensureDb();
    const reader = kind === 'review' ? await db.prepare(`SELECT voter_key FROM book_reviews WHERE id = ? LIMIT 1`).bind(id).first() : null;
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    if (reader?.voter_key) await refreshReaderLevel({ db, visitorKey: reader.voter_key, suppressNotifications: true }).catch(() => null);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить комментарий.' }, { status: 500 });
  }
}
