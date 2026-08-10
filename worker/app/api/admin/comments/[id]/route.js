import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';

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
    const result = await (await ensureDb()).prepare(
      `UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(payload.status, new Date().toISOString(), id).run();
    if (!result.meta?.changes) return Response.json({ error: 'Комментарий не найден.' }, { status: 404 });
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
    await (await ensureDb()).prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить комментарий.' }, { status: 500 });
  }
}
