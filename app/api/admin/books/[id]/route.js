import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { slugify } from '../../../../../lib/books.js';
import { requireBucket, requireDb } from '../../../../../lib/runtime.js';

function normalizePayload(payload = {}) {
  const genres = Array.isArray(payload.genres)
    ? payload.genres.map((genre) => String(genre).trim()).filter(Boolean).slice(0, 8)
    : String(payload.genres || '').split(',').map((genre) => genre.trim()).filter(Boolean).slice(0, 8);
  return {
    title: String(payload.title || '').trim().slice(0, 180),
    originalTitle: String(payload.originalTitle || '').trim().slice(0, 180),
    author: String(payload.author || '').trim().slice(0, 140),
    synopsis: String(payload.synopsis || '').trim().slice(0, 12000),
    genres,
    status: String(payload.status || 'Черновик').trim().slice(0, 80),
    progress: Math.max(0, Math.min(100, Number(payload.progress || 0))),
    coverKey: payload.coverKey ? String(payload.coverKey).trim() : null,
    published: Boolean(payload.published),
    requestedSlug: String(payload.slug || '').trim(),
  };
}

export async function PUT(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const payload = normalizePayload(await request.json());
    if (!payload.title || !payload.author) {
      return Response.json({ error: 'Укажите название книги и автора.' }, { status: 400 });
    }
    const db = requireDb();
    const current = await db.prepare(`SELECT id FROM books WHERE id = ? LIMIT 1`).bind(id).first();
    if (!current) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });

    let slug = slugify(payload.requestedSlug || payload.title);
    const conflict = await db.prepare(`SELECT id FROM books WHERE slug = ? AND id != ? LIMIT 1`).bind(slug, id).first();
    if (conflict) slug = `${slug}-${id.slice(0, 6)}`;

    await db.prepare(
      `UPDATE books SET slug = ?, title = ?, original_title = ?, author = ?, synopsis = ?, genres = ?,
       status = ?, progress = ?, cover_key = ?, published = ?, updated_at = ? WHERE id = ?`
    ).bind(
      slug, payload.title, payload.originalTitle, payload.author, payload.synopsis,
      JSON.stringify(payload.genres), payload.status, payload.progress, payload.coverKey,
      payload.published ? 1 : 0, new Date().toISOString(), id,
    ).run();
    return Response.json({ id, slug });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить книгу.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const db = requireDb();
    const book = await db.prepare(`SELECT cover_key FROM books WHERE id = ? LIMIT 1`).bind(id).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    await db.prepare(`DELETE FROM books WHERE id = ?`).bind(id).run();
    if (book.cover_key) {
      try { await requireBucket().delete(book.cover_key); } catch { /* book deletion remains valid */ }
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить книгу.' }, { status: 500 });
  }
}
