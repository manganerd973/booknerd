import handler from 'vinext/server/fetch-handler';
import { publishDueChapters } from '../lib/books.js';
import { ensureDb } from '../lib/runtime.js';
import { finalizeReaderMonth } from '../lib/reader-levels.js';

export default {
  async fetch(request, env, context) {
    const response = await handler.fetch(request, env, context);
    if (new URL(request.url).pathname !== '/sw.js') return response;
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    headers.set('service-worker-allowed', '/');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },

  scheduled(controller, _env, context) {
    if (controller.cron === '0 1 1 * *') {
      context.waitUntil(ensureDb().then((db) => finalizeReaderMonth(db)).catch(() => null));
      return;
    }
    context.waitUntil(publishDueChapters());
  },
};
