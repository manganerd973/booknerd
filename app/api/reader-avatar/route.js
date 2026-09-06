import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 200 * 1024;

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function avatarUrl(key) {
  return key ? `/api/covers/${String(key).split('/').map(encodeURIComponent).join('/')}` : '';
}

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

export async function POST(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const formData = await request.formData();
    const visitorKey = normalizeVisitorKey(formData.get('visitorKey'));
    const file = formData.get('avatar');
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: 'Выберите фотографию.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: 'Для аватара подходят JPG, PNG и WEBP.' }, { status: 400 });
    if (!file.size || file.size > MAX_AVATAR_BYTES) return Response.json({ error: 'Аватар получился слишком большим. Выберите другое фото.' }, { status: 400 });

    const db = await ensureDb();
    const current = await db.prepare(`SELECT photo_key FROM reader_profiles WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
    const key = `reader-avatars/${crypto.randomUUID()}.${extension}`;
    const now = new Date().toISOString();
    const statements = [
      db.prepare(`INSERT INTO book_covers (key, content_type, data, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?)`)
        .bind(key, file.type, await file.arrayBuffer(), now, `reader:${visitorKey}`),
      db.prepare(`INSERT INTO reader_profiles
        (visitor_key, photo_key, photo_name, photo_content_type, photo_size_bytes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(visitor_key) DO UPDATE SET photo_key = excluded.photo_key, photo_name = excluded.photo_name,
          photo_content_type = excluded.photo_content_type, photo_size_bytes = excluded.photo_size_bytes,
          updated_at = excluded.updated_at`)
        .bind(visitorKey, key, String(file.name || 'avatar').slice(0, 120), file.type, file.size, now, now),
    ];
    if (String(current?.photo_key || '').startsWith('reader-avatars/')) {
      statements.push(db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(current.photo_key));
    }
    await db.batch(statements);
    return Response.json({ ok: true, avatarUrl: avatarUrl(key) }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить аватар.' }, { status: 503 });
  }
}

export async function DELETE(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const payload = await request.json().catch(() => ({}));
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    const db = await ensureDb();
    const current = await db.prepare(`SELECT photo_key FROM reader_profiles WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first();
    const statements = [
      db.prepare(`UPDATE reader_profiles SET photo_key = NULL, photo_name = '', photo_content_type = '', photo_size_bytes = 0, updated_at = ? WHERE visitor_key = ?`)
        .bind(new Date().toISOString(), visitorKey),
    ];
    if (String(current?.photo_key || '').startsWith('reader-avatars/')) {
      statements.push(db.prepare(`DELETE FROM book_covers WHERE key = ?`).bind(current.photo_key));
    }
    await db.batch(statements);
    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить аватар.' }, { status: 503 });
  }
}
