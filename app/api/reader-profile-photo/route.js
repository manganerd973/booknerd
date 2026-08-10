import { env } from 'cloudflare:workers';
import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

function requireBucket() {
  if (!env?.BUCKET) throw new Error('Хранилище фото временно недоступно.');
  return env.BUCKET;
}

function photoPayload(visitorKey, row) {
  return {
    photoUrl: row?.photo_key ? `/api/reader-profile-photo?visitorKey=${encodeURIComponent(visitorKey)}&v=${encodeURIComponent(row.updated_at || Date.now())}` : '',
    photoName: row?.photo_name || '',
    photoContentType: row?.photo_content_type || '',
    photoSizeBytes: Number(row?.photo_size_bytes || 0),
  };
}

export async function GET(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const visitorKey = normalizeVisitorKey(new URL(request.url).searchParams.get('visitorKey'));
    if (!visitorKey) return new Response('Not found', { status: 404 });
    const db = await ensureDb();
    const profile = await db.prepare(
      `SELECT photo_key, photo_name, photo_content_type, photo_size_bytes FROM reader_profiles WHERE visitor_key = ? LIMIT 1`
    ).bind(visitorKey).first();
    if (!profile?.photo_key) return new Response('Not found', { status: 404 });
    const object = await requireBucket().get(profile.photo_key);
    if (!object?.body) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'content-type': profile.photo_content_type || object.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'private, max-age=3600',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(profile.photo_name || 'reader-photo')}`,
      'x-content-type-options': 'nosniff',
    });
    const size = Number(profile.photo_size_bytes || object.size || 0);
    if (size) headers.set('content-length', String(size));
    if (object.httpEtag) headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

export async function POST(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  let uploadedKey = '';
  try {
    const formData = await request.formData();
    const visitorKey = normalizeVisitorKey(formData.get('visitorKey'));
    const file = formData.get('photo');
    if (!visitorKey || !(file instanceof File)) return Response.json({ error: 'Выберите фотографию.' }, { status: 400 });
    const extension = PHOTO_TYPES.get(String(file.type || '').toLowerCase());
    if (!extension) return Response.json({ error: 'Поддерживаются JPG, PNG и WEBP.' }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) return Response.json({ error: 'Фотография должна быть не больше 5 МБ.' }, { status: 400 });

    const db = await ensureDb();
    const now = new Date().toISOString();
    const current = await db.prepare(`SELECT photo_key FROM reader_profiles WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first();
    if (!current) {
      await db.prepare(
        `INSERT INTO reader_profiles (visitor_key, display_name, banner, favorite_characters, favorite_quotes, app_theme, atmosphere, created_at, updated_at)
         VALUES (?, 'Читатель BOOKNERD', 'books', '[]', '[]', 'original', 'auto', ?, ?)`
      ).bind(visitorKey, now, now).run();
    }
    uploadedKey = `reader-profile-photos/${visitorKey}/${crypto.randomUUID()}.${extension}`;
    await requireBucket().put(uploadedKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { visitorKey },
    });
    await db.prepare(
      `UPDATE reader_profiles SET photo_key = ?, photo_name = ?, photo_content_type = ?, photo_size_bytes = ?, updated_at = ? WHERE visitor_key = ?`
    ).bind(uploadedKey, String(file.name || 'Фото читателя').slice(0, 240), file.type, file.size, now, visitorKey).run();
    if (current?.photo_key && current.photo_key !== uploadedKey) await requireBucket().delete(current.photo_key).catch(() => {});
    const updated = await db.prepare(`SELECT photo_key, photo_name, photo_content_type, photo_size_bytes, updated_at FROM reader_profiles WHERE visitor_key = ?`).bind(visitorKey).first();
    return Response.json({ ok: true, photo: photoPayload(visitorKey, updated) }, { status: 201 });
  } catch (error) {
    if (uploadedKey && env?.BUCKET) await env.BUCKET.delete(uploadedKey).catch(() => {});
    return Response.json({ error: error.message || 'Не удалось загрузить фотографию.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const visitorKey = normalizeVisitorKey(new URL(request.url).searchParams.get('visitorKey'));
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    const db = await ensureDb();
    const current = await db.prepare(`SELECT photo_key FROM reader_profiles WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first();
    await db.prepare(
      `UPDATE reader_profiles SET photo_key = NULL, photo_name = '', photo_content_type = '', photo_size_bytes = 0, updated_at = ? WHERE visitor_key = ?`
    ).bind(new Date().toISOString(), visitorKey).run();
    if (current?.photo_key) await requireBucket().delete(current.photo_key).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить фотографию.' }, { status: 500 });
  }
}
