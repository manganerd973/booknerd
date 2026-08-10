import handler from 'vinext/server/fetch-handler';
import { publishDueChapters } from '../lib/books.js';

export default {
  fetch(request, env, context) {
    return handler.fetch(request, env, context);
  },

  scheduled(_controller, _env, context) {
    context.waitUntil(publishDueChapters());
  },
};
