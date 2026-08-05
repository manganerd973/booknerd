import { env } from 'cloudflare:workers';
import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

function parseRange(header, size) {
  const match = String(header || '').match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || !size) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Math.min(size, Number(match[2] || 0));
    if (!suffixLength) return null;
    start = size - suffixLength;
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) return null;
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, start, end };
}

export async function GET(request, { params }) {
  try {
    const { chapterId } = await params;
    const db = await ensureDb();
    const music = await db.prepare(
      `SELECT m.storage_key, m.file_name, m.content_type, m.size_bytes,
              c.status AS chapter_status, b.published AS book_published
       FROM chapter_music m
       JOIN chapters c ON c.id = m.chapter_id
       JOIN books b ON b.id = c.book_id
       WHERE m.chapter_id = ? LIMIT 1`
    ).bind(chapterId).first();
    if (!music) return new Response('Not found', { status: 404 });
    if (music.chapter_status !== 'published' || !music.book_published) {
      const auth = await authorizeAdminRequest(request);
      if (auth.response) return new Response('Not found', { status: 404 });
    }
    if (!env?.BUCKET) return new Response('Music storage unavailable', { status: 503 });

    const declaredSize = Number(music.size_bytes || 0);
    const requestedRange = request.headers.get('range');
    const range = requestedRange ? parseRange(requestedRange, declaredSize) : null;
    if (requestedRange && !range) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${declaredSize}` } });
    }
    const object = await env.BUCKET.get(music.storage_key, range ? { range: { offset: range.offset, length: range.length } } : undefined);
    if (!object?.body) return new Response('Not found', { status: 404 });
    const size = declaredSize || Number(object.size || 0);
    const headers = new Headers({
      'content-type': music.content_type || object.httpMetadata?.contentType || 'application/octet-stream',
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    if (object.httpEtag) headers.set('etag', object.httpEtag);
    if (range) {
      headers.set('content-length', String(range.length));
      headers.set('content-range', `bytes ${range.start}-${range.end}/${size}`);
      return new Response(object.body, { status: 206, headers });
    }
    if (size) headers.set('content-length', String(size));
    return new Response(object.body, { headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
