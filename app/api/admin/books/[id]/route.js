import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { slugify } from '../../../../../lib/books.js';
import { ensureDb } from '../../../../../lib/runtime.js';
import { normalizeGoogleDriveUrl } from '../../../../../lib/google-drive.js';
import { notifyBookPreferenceEvent } from '../../../../../lib/push-notifications.js';

function normalizePayload(payload = {}) {
  const genres = Array.isArray(payload.genres)
    ? payload.genres.map((genre) => String(genre).trim()).filter(Boolean).slice(0, 20)
    : String(payload.genres || '').split(/[,;\n]+/).map((genre) => genre.trim()).filter(Boolean).slice(0, 20);
  const tropes = Array.isArray(payload.tropes)
    ? payload.tropes.map((trope) => String(trope).trim()).filter(Boolean).slice(0, 40)
    : String(payload.tropes || '').split(/[,;\n]+/).map((trope) => trope.trim()).filter(Boolean).slice(0, 40);
  const triggerWarnings = Array.isArray(payload.triggerWarnings)
    ? payload.triggerWarnings.map((warning) => String(warning).trim()).filter(Boolean).slice(0, 40)
    : String(payload.triggerWarnings || '').split(/[,;\n]+/).map((warning) => warning.trim()).filter(Boolean).slice(0, 40);
  const driveUrl = normalizeGoogleDriveUrl(payload.driveUrl);
  const seriesReadingOrder = Array.isArray(payload.seriesReadingOrder)
    ? payload.seriesReadingOrder.slice(0, 80).map((item, index) => ({
      id: String(item?.id || `series-${index + 1}`).slice(0, 100),
      order: Math.max(1, Number(item?.order || index + 1)),
      title: String(item?.title || '').trim().slice(0, 220),
      kind: item?.kind === 'extra' ? 'extra' : 'main',
      translated: item?.translated === true,
      bookSlug: String(item?.bookSlug || '').trim().slice(0, 120),
    })).filter((item) => item.title)
    : [];
  const releaseDays = Array.isArray(payload.releaseDays)
    ? payload.releaseDays.map((day) => String(day).trim()).filter(Boolean).slice(0, 7)
    : [];
  return {
    title: String(payload.title || '').trim().slice(0, 180),
    originalTitle: String(payload.originalTitle || '').trim().slice(0, 180),
    seriesTitle: String(payload.seriesTitle || '').trim().slice(0, 180),
    seriesNumber: payload.seriesNumber ? Math.max(1, Math.floor(Number(payload.seriesNumber))) : null,
    seriesReadingOrder,
    releaseDays,
    author: String(payload.author || '').trim().slice(0, 140),
    dedication: String(payload.dedication || '').trim().slice(0, 2000),
    triggerWarnings,
    hasHotScenes: Boolean(payload.hasHotScenes),
    hotSceneChapters: String(payload.hotSceneChapters || '').trim().slice(0, 160),
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
    const current = await db.prepare(`SELECT id, cover_key, progress, published FROM books WHERE id = ? LIMIT 1`).bind(id).first();
    if (!current) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });

    let slug = slugify(payload.requestedSlug || payload.title);
    const conflict = await db.prepare(`SELECT id FROM books WHERE slug = ? AND id != ? LIMIT 1`).bind(slug, id).first();
    if (conflict) slug = `${slug}-${id.slice(0, 6)}`;

    await db.prepare(
      `UPDATE books SET slug = ?, title = ?, original_title = ?, series_title = ?, series_number = ?, series_reading_order = ?, release_days = ?, author = ?, dedication = ?, trigger_warnings = ?, has_hot_scenes = ?, hot_scene_chapters = ?, synopsis = ?, genres = ?, tropes = ?, drive_url = ?,
       status = ?, progress = ?, cover_key = ?, published = ?, updated_at = ? WHERE id = ?`
    ).bind(
      slug, payload.title, payload.originalTitle, payload.seriesTitle, payload.seriesNumber, JSON.stringify(payload.seriesReadingOrder), JSON.stringify(payload.releaseDays), payload.author, payload.dedication, JSON.stringify(payload.triggerWarnings), payload.hasHotScenes ? 1 : 0, payload.hotSceneChapters, payload.synopsis,
      JSON.stringify(payload.genres), JSON.stringify(payload.tropes), payload.driveUrl, payload.status, payload.progress, payload.coverKey,
      payload.published ? 1 : 0, new Date().toISOString(), id,
    ).run();
    if (current.cover_key && current.cover_key !== payload.coverKey) {
      await db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(current.cover_key).run();
    }
    if (
      payload.published
      && payload.progress >= 100
      && (Number(current.progress || 0) < 100 || !current.published)
    ) {
      await notifyBookPreferenceEvent({
        bookId: id,
        preference: 'translationComplete',
        title: 'Перевод завершён ✦',
        body: `BOOKNERD завершил перевод книги «${payload.title}».`,
        url: `/books/${slug}`,
        topic: `complete-${id.slice(0, 16)}`,
        requestUrl: request.url,
      }).catch(() => {});
    }
    if (!current.published && payload.published) {
      await notifyBookPreferenceEvent({
        bookId: id,
        preference: 'authorBook',
        title: 'Новая книга автора в BOOKNERD ✦',
        body: `«${payload.title}» уже появилась в библиотеке.`,
        url: `/books/${slug}`,
        topic: `author-${id.slice(0, 18)}`,
        requestUrl: request.url,
        sameAuthor: true,
      }).catch(() => {});
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
    const artworkRows = await db.prepare(`SELECT image_key FROM book_artworks WHERE book_id = ?`).bind(id).all();
    const artworkKeys = (artworkRows.results || []).map((row) => row.image_key).filter(Boolean);
    await db.batch([
      db.prepare(`DELETE FROM book_artworks WHERE book_id = ?`).bind(id),
      db.prepare(`DELETE FROM books WHERE id = ?`).bind(id),
      ...(book.cover_key ? [db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(book.cover_key)] : []),
      ...artworkKeys.map((key) => db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(key)),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить книгу.' }, { status: 500 });
  }
}
