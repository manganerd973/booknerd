import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { slugify } from '../../../../../lib/books.js';
import { ensureDb } from '../../../../../lib/runtime.js';
import { normalizeGoogleDriveUrl } from '../../../../../lib/google-drive.js';

function normalizePayload(payload = {}) {
  const genres = Array.isArray(payload.genres)
    ? payload.genres.map((genre) => String(genre).trim()).filter(Boolean).slice(0, 8)
    : String(payload.genres || '').split(',').map((genre) => genre.trim()).filter(Boolean).slice(0, 8);
  const tropes = Array.isArray(payload.tropes)
    ? payload.tropes.map((trope) => String(trope).trim()).filter(Boolean).slice(0, 16)
    : String(payload.tropes || '').split(',').map((trope) => trope.trim()).filter(Boolean).slice(0, 16);
  const driveUrl = normalizeGoogleDriveUrl(payload.driveUrl);
  return {
    title: String(payload.title || '').trim().slice(0, 180),
    originalTitle: String(payload.originalTitle || '').trim().slice(0, 180),
    seriesTitle: String(payload.seriesTitle || '').trim().slice(0, 180),
    seriesNumber: payload.seriesNumber ? Math.max(1, Math.floor(Number(payload.seriesNumber))) : null,
    author: String(payload.author || '').trim().slice(0, 140),
    synopsis: String(payload.synopsis || '').trim().slice(0, 12000),
    genres,
    tropes,
    driveUrl,
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
    if (payload.driveUrl === null) {
      return Response.json({ error: 'Вставьте ссылку с drive.google.com или docs.google.com.' }, { status: 400 });
    }
    const db = await ensureDb();
    const current = await db.prepare(`SELECT id, cover_key FROM books WHERE id = ? LIMIT 1`).bind(id).first();
    if (!current) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });

    let slug = slugify(payload.requestedSlug || payload.title);
    const conflict = await db.prepare(`SELECT id FROM books WHERE slug = ? AND id != ? LIMIT 1`).bind(slug, id).first();
    if (conflict) slug = `${slug}-${id.slice(0, 6)}`;

    await db.prepare(
      `UPDATE books SET slug = ?, title = ?, original_title = ?, series_title = ?, series_number = ?, author = ?, synopsis = ?, genres = ?, tropes = ?, drive_url = ?,
       status = ?, progress = ?, cover_key = ?, published = ?, updated_at = ? WHERE id = ?`
    ).bind(
      slug, payload.title, payload.originalTitle, payload.seriesTitle, payload.seriesNumber, payload.author, payload.synopsis,
      JSON.stringify(payload.genres), JSON.stringify(payload.tropes), payload.driveUrl, payload.status, payload.progress, payload.coverKey,
      payload.published ? 1 : 0, new Date().toISOString(), id,
    ).run();
    if (current.cover_key && current.cover_key !== payload.coverKey) {
      await db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(current.cover_key).run();
    }
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
    const db = await ensureDb();
    const book = await db.prepare(`SELECT cover_key FROM books WHERE id = ? LIMIT 1`).bind(id).first();
    if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    await db.prepare(`DELETE FROM books WHERE id = ?`).bind(id).run();
    if (book.cover_key) {
      await db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(book.cover_key).run();
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить книгу.' }, { status: 500 });
  }
}
