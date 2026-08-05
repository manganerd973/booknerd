import { env } from 'cloudflare:workers';
import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../lib/runtime.js';

const MAX_MAP_BYTES = 15 * 1024 * 1024;
const MAP_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function getBucket() {
  if (!env?.BUCKET) throw new Error('Хранилище карты временно недоступно.');
  return env.BUCKET;
}

function mapPayload(bookId, row) {
  return {
    worldMapKey: row.world_map_key || null,
    worldMapName: row.world_map_name || '',
    worldMapContentType: row.world_map_content_type || '',
    worldMapSizeBytes: Number(row.world_map_size_bytes || 0),
    worldMapUrl: row.world_map_key ? `/api/books/${encodeURIComponent(bookId)}/world-map` : null,
  };
}

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  let uploadedKey = '';
  try {
    const { id: bookId } = await params;
    const formData = await request.formData();
    const file = formData.get('map');
    if (!(file instanceof File)) return Response.json({ error: 'Выберите изображение карты.' }, { status: 400 });
    const extension = MAP_TYPES.get(String(file.type || '').toLowerCase());
    if (!extension) return Response.json({ error: 'Для карты поддерживаются JPG, PNG и WEBP.' }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_MAP_BYTES) return Response.json({ error: 'Карта должна быть не больше 15 МБ.' }, { status: 400 });

    const db = await ensureDb();
    const current = await db.prepare(`SELECT id, world_map_key FROM books WHERE id = ? LIMIT 1`).bind(bookId).first();
    if (!current) return Response.json({ error: 'Сначала сохраните книгу.' }, { status: 404 });
    uploadedKey = `book-maps/${bookId}/${crypto.randomUUID()}.${extension}`;
    await getBucket().put(uploadedKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { bookId, uploadedBy: auth.email || auth.displayName || '' },
    });
    await db.prepare(
      `UPDATE books SET world_map_key = ?, world_map_name = ?, world_map_content_type = ?, world_map_size_bytes = ?, updated_at = ? WHERE id = ?`
    ).bind(uploadedKey, String(file.name || 'Карта мира').slice(0, 240), file.type, file.size, new Date().toISOString(), bookId).run();
    if (current.world_map_key && current.world_map_key !== uploadedKey) await getBucket().delete(current.world_map_key).catch(() => {});
    const updated = await db.prepare(`SELECT world_map_key, world_map_name, world_map_content_type, world_map_size_bytes FROM books WHERE id = ?`).bind(bookId).first();
    return Response.json({ map: mapPayload(bookId, updated) }, { status: 201 });
  } catch (error) {
    if (uploadedKey && env?.BUCKET) await env.BUCKET.delete(uploadedKey).catch(() => {});
    return Response.json({ error: error.message || 'Не удалось загрузить карту.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const db = await ensureDb();
    const current = await db.prepare(`SELECT world_map_key FROM books WHERE id = ? LIMIT 1`).bind(bookId).first();
    if (!current) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    await db.prepare(
      `UPDATE books SET world_map_key = NULL, world_map_name = '', world_map_content_type = '', world_map_size_bytes = 0, updated_at = ? WHERE id = ?`
    ).bind(new Date().toISOString(), bookId).run();
    if (current.world_map_key) await getBucket().delete(current.world_map_key).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить карту.' }, { status: 500 });
  }
}
