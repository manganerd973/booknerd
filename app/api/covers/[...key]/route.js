import { ensureDb } from '../../../../lib/runtime.js';

export async function GET(_request, { params }) {
  const values = await params;
  const key = Array.isArray(values.key) ? values.key.join('/') : String(values.key || '');
  if (!key) return new Response('Not found', { status: 404 });

  let cover;
  try {
    cover = await (await ensureDb()).prepare(
      `SELECT content_type, data FROM book_covers WHERE key = ? LIMIT 1`
    ).bind(key).first();
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!cover?.data) return new Response('Not found', { status: 404 });

  let body = cover.data;
  if (Array.isArray(body)) body = new Uint8Array(body);
  if (body?.buffer instanceof ArrayBuffer && !(body instanceof ArrayBuffer)) {
    body = body.buffer.slice(body.byteOffset || 0, (body.byteOffset || 0) + body.byteLength);
  }

  const headers = new Headers();
  headers.set('content-type', cover.content_type || 'application/octet-stream');
  headers.set('etag', `"${key}"`);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(body, { headers });
}
