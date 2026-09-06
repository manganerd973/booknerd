import { hasReaderAccess } from '../../../lib/reader-access.js';
import { getNextQuoteChangeAt, getQuotePool } from '../../../lib/reader-notes.js';

export const dynamic = 'force-dynamic';

const QUOTE_INTERVAL_MS = 2 * 60 * 1000;
const POOL_CACHE_MS = 30 * 60 * 1000;
const CACHE_VERSION = 'v42';
let pendingSlot = null;
let pendingPayload = null;

function quoteSlot(now) {
  return Math.floor(now.getTime() / QUOTE_INTERVAL_MS);
}

function poolSlot(now) {
  return Math.floor(now.getTime() / POOL_CACHE_MS);
}

function cacheRequest(request, slot) {
  const url = new URL(request.url);
  url.pathname = '/__booknerd-cache/quote-of-day';
  url.search = `version=${CACHE_VERSION}&slot=${slot}`;
  return new Request(url.toString(), { method: 'GET' });
}

function clientResponse(payload, cacheStatus) {
  return Response.json(payload, {
    headers: {
      'cache-control': 'private, no-store, max-age=0',
      'x-booknerd-cache': cacheStatus,
    },
  });
}

async function createPayload(now, slot) {
  if (pendingSlot === slot && pendingPayload) return pendingPayload;
  pendingSlot = slot;
  pendingPayload = getQuotePool()
    .then((quotes) => {
      const currentSlot = quoteSlot(now);
      return {
        quotes,
        quote: quotes[currentSlot % quotes.length] || null,
        nextChangeAt: getNextQuoteChangeAt(now),
      };
    })
    .finally(() => {
      if (pendingSlot === slot) {
        pendingSlot = null;
        pendingPayload = null;
      }
    });
  return pendingPayload;
}

export async function GET(request) {
  if (!(await hasReaderAccess(request))) {
    return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  }
  try {
    const now = new Date();
    const slot = poolSlot(now);
    const edgeCache = globalThis.caches?.default || null;
    const key = cacheRequest(request, slot);
    if (edgeCache) {
      const cached = await edgeCache.match(key).catch(() => null);
      if (cached) {
        const payload = await cached.json().catch(() => null);
        if (payload?.quote && Array.isArray(payload?.quotes)) return clientResponse(payload, 'HIT');
      }
    }

    const payload = await createPayload(now, slot);
    if (edgeCache && payload?.quote) {
      const nextPoolSlot = (slot + 1) * POOL_CACHE_MS;
      const secondsUntilChange = Math.max(1, Math.ceil((nextPoolSlot - Date.now()) / 1000));
      const cacheable = Response.json(payload, {
        headers: { 'cache-control': `public, max-age=${secondsUntilChange}` },
      });
      await edgeCache.put(key, cacheable).catch(() => {});
    }
    return clientResponse(payload, 'MISS');
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось обновить цитату.' }, { status: 500 });
  }
}
