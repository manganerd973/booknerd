import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../lib/runtime.js';

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const db = await ensureDb();
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? LIMIT 1`).bind(id).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });

    await db.prepare(`UPDATE books SET release_days = '[]', updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();

    return Response.json({ ok: true, releaseDays: [] });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось отключить книгу от календаря.' }, { status: 500 });
  }
}
