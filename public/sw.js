const SHELL_CACHE = 'booknerd-shell-v17';
const OFFLINE_CACHE = 'booknerd-offline-books-v9';
const SHELL_URLS = ['/', '/translations', '/library', '/calendar', '/manifest.webmanifest', '/booknerd-icon-v4-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('booknerd-') && ![SHELL_CACHE, OFFLINE_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim())
));

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'BOOKNERD_SAVE_BOOK') return;
  const urls = [...new Set((event.data.urls || []).filter((url) => typeof url === 'string' && url.startsWith('/')))];
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(OFFLINE_CACHE);
      for (const url of urls) {
        const response = await fetch(new Request(url, { credentials: 'include' }));
        if (response.ok) await cache.put(url, response.clone());
      }
      event.ports?.[0]?.postMessage({ ok: true, saved: urls.length });
    } catch (error) {
      event.ports?.[0]?.postMessage({ ok: false, error: error?.message || 'Не удалось сохранить книгу.' });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) return;
  // APIs are live data; do not search the entire offline cache for every poll.
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
    // Versioned bundles and fonts are immutable. Reuse them immediately.
    const immutableAsset = url.pathname.startsWith('/_next/static/') || request.destination === 'font';
    if (immutableAsset && cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected && (request.mode === 'navigate' || ['style', 'script', 'font', 'image'].includes(request.destination))) {
        const cache = await caches.open(request.mode === 'navigate' ? OFFLINE_CACHE : SHELL_CACHE);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match('/')) || new Response('Нет соединения. Попробуйте открыть страницу позже.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      return Response.error();
    }
  })());
});
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch { data = { body: event.data?.text?.() || '' }; }
  const options = {
    icon: '/booknerd-icon-v4-192.png',
    badge: '/booknerd-icon-v4-192.png',
    data: { url: data.url || '/' },
    tag: data.topic ? `booknerd-${data.topic}` : data.chapterId ? `booknerd-${data.chapterId}` : 'booknerd-update',
    renotify: true,
  };
  options.body = [typeof data.title === 'string' && data.title.trim() !== 'BOOKNERD' ? data.title.trim() : '', typeof data.body === 'string' ? data.body.trim() : ''].filter(Boolean).join('\n');
  event.waitUntil(self.registration.showNotification('BOOKNERD', options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
