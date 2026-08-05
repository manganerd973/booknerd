import { env } from 'cloudflare:workers';
import { authorizeAdminRequest } from '../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../lib/runtime.js';

export async function GET(request, { params }) {
  try {
    const { id: bookId } = await params;
    const db = await ensureDb();
    const map = await db.prepare(
      `SELECT world_map_key, world_map_name, world_map_content_type, world_map_size_bytes, published FROM books WHERE id = ? LIMIT 1`
    ).bind(bookId).first();
    if (!map?.world_map_key) return new Response('Not found', { status: 404 });
    if (!map.published) {
      const auth = await authorizeAdminRequest(request);
      if (auth.response) return new Response('Not found', { status: 404 });
    }
    if (!env?.BUCKET) return new Response('Map storage unavailable', { status: 503 });
    const object = await env.BUCKET.get(map.world_map_key);
    if (!object?.body) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'content-type': map.world_map_content_type || object.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'private, max-age=3600',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(map.world_map_name || 'book-map')}`,
      'x-content-type-options': 'nosniff',
    });
    const size = Number(map.world_map_size_bytes || object.size || 0);
    if (size) headers.set('content-length', String(size));
    if (object.httpEtag) headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
