import { getBucket } from '../../../../lib/runtime.js';

export async function GET(_request, { params }) {
  const bucket = getBucket();
  if (!bucket) return new Response('Not found', { status: 404 });
  const values = await params;
  const key = Array.isArray(values.key) ? values.key.join('/') : String(values.key || '');
  const object = await bucket.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag || object.etag);
  headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}
