import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';

export async function PATCH(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const payload = await request.json();
    const db = await ensureDb();
    const current = await db.prepare(`SELECT id, status, is_pinned FROM reader_public_notes WHERE id = ? LIMIT 1`).bind(id).first();
    if (!current) return Response.json({ error: 'Заметка не найдена.' }, { status: 404 });

    const now = new Date().toISOString();
    if (payload.isPinned === true) {
      const note = await db.prepare(`SELECT is_spoiler FROM reader_public_notes WHERE id = ? LIMIT 1`).bind(id).first();
      if (note?.is_spoiler) return Response.json({ error: 'Заметку со спойлером нельзя закрепить на главной.' }, { status: 400 });
      await db.batch([
        db.prepare(`UPDATE reader_public_notes SET is_pinned = 0, updated_at = ? WHERE is_pinned = 1 AND id != ?`).bind(now, id),
        db.prepare(`UPDATE reader_public_notes SET status = 'approved', is_pinned = 1, approved_at = COALESCE(approved_at, ?), updated_at = ? WHERE id = ? AND is_spoiler = 0`).bind(now, now, id),
      ]);
      return Response.json({ ok: true });
    }

    if (payload.isPinned === false) {
      await db.prepare(`UPDATE reader_public_notes SET is_pinned = 0, updated_at = ? WHERE id = ?`).bind(now, id).run();
      return Response.json({ ok: true });
    }

    const status = String(payload.status || '');
    if (!['pending', 'approved', 'hidden'].includes(status)) {
      return Response.json({ error: 'Неизвестный статус заметки.' }, { status: 400 });
    }
    if (status === 'approved') {
      const note = await db.prepare(`SELECT is_spoiler FROM reader_public_notes WHERE id = ? LIMIT 1`).bind(id).first();
      if (note?.is_spoiler) return Response.json({ error: 'Заметку со спойлером нельзя показать на главной.' }, { status: 400 });
    }
    await db.prepare(
      `UPDATE reader_public_notes
       SET status = ?, is_pinned = CASE WHEN ? = 'approved' THEN is_pinned ELSE 0 END,
           approved_at = CASE WHEN ? = 'approved' THEN COALESCE(approved_at, ?) ELSE NULL END,
           updated_at = ? WHERE id = ?`
    ).bind(status, status, status, now, now, id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось изменить заметку.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    await (await ensureDb()).prepare(`DELETE FROM reader_public_notes WHERE id = ?`).bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить заметку.' }, { status: 500 });
  }
}
