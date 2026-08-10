import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const db = await ensureDb();
    const artwork = await db.prepare(`SELECT image_key FROM book_artworks WHERE id = ? LIMIT 1`).bind(id).first();
    if (!artwork) return Response.json({ error: 'Арт не найден.' }, { status: 404 });
    await db.batch([
      db.prepare(`DELETE FROM book_artworks WHERE id = ?`).bind(id),
      db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(artwork.image_key),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить арт.' }, { status: 500 });
  }
}
