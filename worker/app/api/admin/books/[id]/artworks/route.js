import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { mapArtwork } from '../../../../../../lib/artworks.js';
import { ensureDb } from '../../../../../../lib/runtime.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxArtworkBytes = 1_500_000;
const maxArtworksPerBook = 8;

export async function GET(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const result = await (await ensureDb()).prepare(
      `SELECT * FROM book_artworks WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC`
    ).bind(bookId).all();
    return Response.json({ artworks: (result.results || []).map(mapArtwork) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить арты.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const formData = await request.formData();
    const file = formData.get('image');
    const caption = String(formData.get('caption') || '').trim().slice(0, 240);
    if (!(file instanceof File)) {
      return Response.json({ error: 'Выберите изображение для галереи.' }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return Response.json({ error: 'Поддерживаются JPG, PNG и WEBP.' }, { status: 400 });
    }
    if (file.size > maxArtworkBytes) {
      return Response.json({ error: 'Изображение слишком большое. Выберите файл поменьше.' }, { status: 400 });
    }

    const db = await ensureDb();
    const book = await db.prepare(`SELECT id FROM books WHERE id = ? LIMIT 1`).bind(bookId).first();
    if (!book) return Response.json({ error: 'Сначала сохраните книгу.' }, { status: 404 });
    const countRow = await db.prepare(`SELECT COUNT(*) AS count FROM book_artworks WHERE book_id = ?`).bind(bookId).first();
    const count = Number(countRow?.count || 0);
    if (count >= maxArtworksPerBook) {
      return Response.json({ error: `К одной книге можно добавить до ${maxArtworksPerBook} артов.` }, { status: 400 });
    }

    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const artworkId = crypto.randomUUID();
    const imageKey = `artworks/${bookId}/${crypto.randomUUID()}.${extension}`;
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`INSERT INTO book_covers (key, content_type, data, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?)`)
        .bind(imageKey, file.type, await file.arrayBuffer(), now, auth.email),
      db.prepare(`INSERT INTO book_artworks (id, book_id, image_key, caption, sort_order, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(artworkId, bookId, imageKey, caption, count, now, auth.email),
    ]);
    const artwork = await db.prepare(`SELECT * FROM book_artworks WHERE id = ? LIMIT 1`).bind(artworkId).first();
    return Response.json({ artwork: mapArtwork(artwork) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось добавить арт.' }, { status: 500 });
  }
}
