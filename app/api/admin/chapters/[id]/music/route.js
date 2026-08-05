import { env } from 'cloudflare:workers';
import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../lib/runtime.js';

const MAX_MUSIC_BYTES = 25 * 1024 * 1024;
const MUSIC_TYPES = new Map([
  ['audio/mpeg', 'mp3'],
  ['audio/mp3', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/x-m4a', 'm4a'],
  ['audio/aac', 'aac'],
  ['audio/ogg', 'ogg'],
  ['audio/opus', 'opus'],
  ['audio/webm', 'webm'],
  ['audio/wav', 'wav'],
  ['audio/x-wav', 'wav'],
]);

function getMusicBucket() {
  if (!env?.BUCKET) throw new Error('Хранилище музыки временно недоступно.');
  return env.BUCKET;
}

function normalizedMusicFile(file) {
  const fileName = String(file?.name || '').trim().slice(0, 240);
  const fromType = MUSIC_TYPES.get(String(file?.type || '').toLowerCase());
  const fromName = fileName.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1] || '';
  const extension = fromType || (['mp3', 'm4a', 'aac', 'ogg', 'opus', 'webm', 'wav'].includes(fromName) ? fromName : '');
  if (!extension) return null;
  const contentType = String(file?.type || '').startsWith('audio/')
    ? String(file.type).toLowerCase()
    : extension === 'mp3' ? 'audio/mpeg' : extension === 'm4a' ? 'audio/mp4' : `audio/${extension}`;
  return { extension, contentType, fileName: fileName || `music.${extension}` };
}

function musicPayload(row) {
  return {
    musicUrl: `/api/chapter-music/${encodeURIComponent(row.chapter_id)}`,
    musicTitle: row.title || '',
    musicArtist: row.artist || '',
    musicFileName: row.file_name || '',
    musicContentType: row.content_type || '',
    musicSizeBytes: Number(row.size_bytes || 0),
  };
}

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  let uploadedKey = '';
  try {
    const { id: chapterId } = await params;
    const formData = await request.formData();
    const file = formData.get('music');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Выберите музыкальный файл для главы.' }, { status: 400 });
    }
    const normalized = normalizedMusicFile(file);
    if (!normalized) {
      return Response.json({ error: 'Поддерживаются MP3, M4A, AAC, OGG, OPUS, WEBM и WAV.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_MUSIC_BYTES) {
      return Response.json({ error: 'Музыкальный файл должен быть не больше 25 МБ.' }, { status: 400 });
    }

    const db = await ensureDb();
    const chapter = await db.prepare(`SELECT id, book_id FROM chapters WHERE id = ? LIMIT 1`).bind(chapterId).first();
    if (!chapter) return Response.json({ error: 'Сначала сохраните главу.' }, { status: 404 });
    const current = await db.prepare(`SELECT storage_key FROM chapter_music WHERE chapter_id = ? LIMIT 1`).bind(chapterId).first();
    const title = String(formData.get('title') || '').trim().slice(0, 180) || normalized.fileName.replace(/\.[^.]+$/, '');
    const artist = String(formData.get('artist') || '').trim().slice(0, 180);
    const now = new Date().toISOString();
    uploadedKey = `chapter-music/${chapter.book_id}/${chapterId}/${crypto.randomUUID()}.${normalized.extension}`;
    const bucket = getMusicBucket();
    await bucket.put(uploadedKey, file.stream(), {
      httpMetadata: { contentType: normalized.contentType },
      customMetadata: { chapterId, title, artist },
    });

    await db.prepare(
      `INSERT INTO chapter_music
       (chapter_id, storage_key, file_name, title, artist, content_type, size_bytes, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(chapter_id) DO UPDATE SET
         storage_key = excluded.storage_key,
         file_name = excluded.file_name,
         title = excluded.title,
         artist = excluded.artist,
         content_type = excluded.content_type,
         size_bytes = excluded.size_bytes,
         uploaded_at = excluded.uploaded_at,
         uploaded_by = excluded.uploaded_by`
    ).bind(chapterId, uploadedKey, normalized.fileName, title, artist, normalized.contentType, file.size, now, auth.email || auth.displayName || '').run();

    if (current?.storage_key && current.storage_key !== uploadedKey) {
      await bucket.delete(current.storage_key).catch(() => {});
    }
    const music = await db.prepare(`SELECT * FROM chapter_music WHERE chapter_id = ? LIMIT 1`).bind(chapterId).first();
    return Response.json({ music: musicPayload(music) }, { status: 201 });
  } catch (error) {
    if (uploadedKey && env?.BUCKET) await env.BUCKET.delete(uploadedKey).catch(() => {});
    return Response.json({ error: error.message || 'Не удалось добавить музыку к главе.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: chapterId } = await params;
    const input = await request.json();
    const title = String(input.title || '').trim().slice(0, 180);
    const artist = String(input.artist || '').trim().slice(0, 180);
    const db = await ensureDb();
    const current = await db.prepare(`SELECT * FROM chapter_music WHERE chapter_id = ? LIMIT 1`).bind(chapterId).first();
    if (!current) return Response.json({ error: 'К этой главе музыка ещё не добавлена.' }, { status: 404 });
    await db.prepare(`UPDATE chapter_music SET title = ?, artist = ? WHERE chapter_id = ?`)
      .bind(title || String(current.file_name || '').replace(/\.[^.]+$/, ''), artist, chapterId).run();
    const music = await db.prepare(`SELECT * FROM chapter_music WHERE chapter_id = ? LIMIT 1`).bind(chapterId).first();
    return Response.json({ music: musicPayload(music) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить подпись музыки.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: chapterId } = await params;
    const db = await ensureDb();
    const current = await db.prepare(`SELECT storage_key FROM chapter_music WHERE chapter_id = ? LIMIT 1`).bind(chapterId).first();
    if (!current) return Response.json({ ok: true });
    await db.prepare(`DELETE FROM chapter_music WHERE chapter_id = ?`).bind(chapterId).run();
    await getMusicBucket().delete(current.storage_key).catch(() => {});
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить музыку главы.' }, { status: 500 });
  }
}
