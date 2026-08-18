import handler from 'vinext/server/fetch-handler';
import { publishDueChapters } from '../lib/books.js';

export default {
  async fetch(request, env, context) {
    const response = await handler.fetch(request, env, context);
    if (new URL(request.url).pathname !== '/sw.js') return response;
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    headers.set('service-worker-allowed', '/');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },

  scheduled(_controller, _env, context) {
    context.waitUntil(publishDueChapters());
  },
};
