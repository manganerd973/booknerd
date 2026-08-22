import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../lib/runtime.js';
import { mapWorldMap, normalizeWorldMapMarkers } from '../../../../../../lib/world-map.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxMapBytes = 1_400_000;

function publicMap(row) {
  return mapWorldMap(row);
}

export async function GET(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const row = await (await ensureDb()).prepare(
      `SELECT world_map_key, world_map_name, world_map_content_type, world_map_size_bytes, world_map_markers
       FROM books WHERE id = ? LIMIT 1`
    ).bind(bookId).first();
    if (!row) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    return Response.json({ worldMap: publicMap(row) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть карту.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const formData = await request.formData();
    const file = formData.get('map');
    const markers = normalizeWorldMapMarkers(String(formData.get('markers') || '[]'));
    const requestedName = String(formData.get('name') || '').trim().slice(0, 180);
    const db = await ensureDb();
    const current = await db.prepare(
      `SELECT world_map_key, world_map_name, world_map_content_type, world_map_size_bytes, world_map_markers
       FROM books WHERE id = ? LIMIT 1`
    ).bind(bookId).first();
    if (!current) return Response.json({ error: 'Сначала сохраните книгу.' }, { status: 404 });

    const hasNewFile = file instanceof File && file.size > 0;
    if (!hasNewFile && !current.world_map_key) {
      return Response.json({ error: 'Сначала выберите изображение карты.' }, { status: 400 });
    }
    if (hasNewFile && !allowedTypes.has(file.type)) {
      return Response.json({ error: 'Для карты подходят JPG, PNG и WEBP.' }, { status: 400 });
    }
    if (hasNewFile && file.size > maxMapBytes) {
      return Response.json({ error: 'Карта слишком большая. Выберите файл поменьше.' }, { status: 400 });
    }

    let mapKey = current.world_map_key;
    let contentType = current.world_map_content_type || 'image/webp';
    let sizeBytes = Number(current.world_map_size_bytes || 0);
    let insertedKey = null;
    if (hasNewFile) {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      mapKey = `maps/${bookId}/${crypto.randomUUID()}.${extension}`;
      contentType = file.type;
      sizeBytes = file.size;
      insertedKey = mapKey;
      await db.prepare(
        `INSERT INTO book_covers (key, content_type, data, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?)`
      ).bind(mapKey, contentType, await file.arrayBuffer(), new Date().toISOString(), auth.email).run();
    }

    const mapName = requestedName || current.world_map_name || 'Карта мира';
    try {
      await db.prepare(
        `UPDATE books
         SET world_map_key = ?, world_map_name = ?, world_map_content_type = ?, world_map_size_bytes = ?, world_map_markers = ?, updated_at = ?
         WHERE id = ?`
      ).bind(mapKey, mapName, contentType, sizeBytes, JSON.stringify(markers), new Date().toISOString(), bookId).run();
    } catch (error) {
      if (insertedKey) await db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(insertedKey).run().catch(() => {});
      throw error;
    }
    if (insertedKey && current.world_map_key && current.world_map_key !== insertedKey) {
      await db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(current.world_map_key).run();
    }
    const saved = await db.prepare(
      `SELECT world_map_key, world_map_name, world_map_content_type, world_map_size_bytes, world_map_markers
       FROM books WHERE id = ? LIMIT 1`
    ).bind(bookId).first();
    return Response.json({ worldMap: publicMap(saved) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить карту.' }, { status: 500 });
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
      `UPDATE books
       SET world_map_key = NULL, world_map_name = '', world_map_content_type = '', world_map_size_bytes = 0, world_map_markers = '[]', updated_at = ?
       WHERE id = ?`
    ).bind(new Date().toISOString(), bookId).run();
    if (current.world_map_key) await db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(current.world_map_key).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить карту.' }, { status: 500 });
  }
}
