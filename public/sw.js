const SHELL_CACHE = 'booknerd-shell-v31';
const OFFLINE_CACHE = 'booknerd-offline-library-v2';
const OFFLINE_FALLBACK = '/offline.html';
const NAVIGATION_TIMEOUT = 45000;
const ASSET_TIMEOUT = 30000;
const BOOK_DOWNLOAD_TIMEOUT = 45000;
const BOOK_DOWNLOAD_CONCURRENCY = 3;
const REACTION_STICKER_URLS = Array.from({ length: 25 }, (_, index) => `/reaction-stickers/sticker-${String(index + 1).padStart(2, '0')}.jpg`);
const PRELOAD_URLS = ['/', OFFLINE_FALLBACK, '/manifest.webmanifest', '/booknerd-icon-v2-192.png', ...REACTION_STICKER_URLS];
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

function isAppAsset(pathname) {
  return pathname.startsWith('/_next/static/')
    || pathname.startsWith('/assets/')
    || /\.(?:css|js|mjs|woff2?|ttf)$/i.test(pathname);
}

function linkedAssets(html, baseUrl) {
  const urls = new Set();
  const expression = /(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(expression)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === self.location.origin && isAppAsset(url.pathname)) urls.add(url.pathname + url.search);
    } catch {
      // Ignore invalid markup URLs; the document itself remains available.
    }
  }
  return [...urls];
}

async function fetchAndCacheAsset(cache, url) {
  const request = new Request(url, { credentials: 'include', cache: 'reload' });
  const existing = await cache.match(request);
  if (existing) return true;
  const response = await fetchWithTimeout(request, ASSET_TIMEOUT);
  if (!response.ok || response.redirected) return false;
  await cache.put(request, response.clone());
  return true;
}

async function cacheDocument(cache, request, response) {
  await cache.put(request, response.clone());
  if (!(response.headers.get('content-type') || '').includes('text/html')) return;
  const html = await response.clone().text();
  await Promise.allSettled(linkedAssets(html, response.url || request.url).map((url) => fetchAndCacheAsset(cache, url)));
}

async function warmShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(PRELOAD_URLS.map(async (url) => {
    const request = new Request(url, { credentials: 'include', cache: 'reload' });
    const response = await fetchWithTimeout(request, ASSET_TIMEOUT);
    if (!response.ok || response.redirected) return;
    await cacheDocument(cache, request, response);
  }));
}

async function migrateLegacyCaches() {
  const keys = await caches.keys();
  const offline = await caches.open(OFFLINE_CACHE);
  for (const key of keys) {
    if (key === SHELL_CACHE || key === OFFLINE_CACHE) continue;
    const legacyOffline = key.startsWith('booknerd-offline-books-') || key.startsWith('booknerd-offline-library-');
    const legacyShell = key.startsWith('booknerd-shell-');
    if (legacyOffline || legacyShell) {
      const legacy = await caches.open(key);
      for (const request of await legacy.keys()) {
        const url = new URL(request.url);
        const keep = legacyOffline
          ? url.pathname.startsWith('/books/') || url.pathname.startsWith('/api/covers/') || isAppAsset(url.pathname)
          : isAppAsset(url.pathname);
        if (!keep || await offline.match(request)) continue;
        const response = await legacy.match(request);
        if (response) await offline.put(request, response);
      }
    }
    if (key.startsWith('booknerd-')) await caches.delete(key);
  }
}

async function enableNavigationPreload() {
  if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
}

function fetchWithTimeout(request, timeout = NAVIGATION_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([migrateLegacyCaches(), enableNavigationPreload()]).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'BOOKNERD_SAVE_BOOK') return;
  const urls = [...new Set((event.data.urls || []).filter((url) => typeof url === 'string' && url.startsWith('/')))];
  const port = event.ports?.[0];
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(OFFLINE_CACHE);
      let saved = 0;
      let completed = 0;
      const failedRequired = [];
      const saveUrl = async (url) => {
        try {
          const request = new Request(url, { credentials: 'include', cache: 'reload' });
          const response = await fetchWithTimeout(request, BOOK_DOWNLOAD_TIMEOUT);
          const redirectedToAccess = response.redirected && new URL(response.url).pathname.startsWith('/reader-access');
          if (!response.ok || redirectedToAccess) throw new Error('Страница недоступна для сохранения.');
          await cacheDocument(cache, request, response);
          saved += 1;
        } catch {
          if (url.startsWith('/books/')) failedRequired.push(url);
        } finally {
          completed += 1;
          port?.postMessage({ type: 'progress', completed, total: urls.length, saved });
        }
      };
      for (let index = 0; index < urls.length; index += BOOK_DOWNLOAD_CONCURRENCY) {
        await Promise.all(urls.slice(index, index + BOOK_DOWNLOAD_CONCURRENCY).map(saveUrl));
      }
      if (!saved || failedRequired.length) throw new Error('Не все главы удалось сохранить. Проверьте соединение и повторите загрузку.');
      port?.postMessage({ type: 'complete', ok: true, saved, total: urls.length });
    } catch (error) {
      port?.postMessage({ type: 'complete', ok: false, error: error?.message || 'Не удалось сохранить книгу.' });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        let response = null;
        try { response = await event.preloadResponse; } catch { /* Fall back to a regular request. */ }
        if (!response) response = await fetchWithTimeout(request);
        if (response.ok && !response.redirected) {
          event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cacheDocument(cache, request, response.clone())));
        }
        return response;
      } catch {
        const offline = await caches.open(OFFLINE_CACHE);
        const savedPage = await offline.match(request, { ignoreSearch: true });
        if (savedPage) return savedPage;
        const shell = await caches.open(SHELL_CACHE);
        return await shell.match(request, { ignoreSearch: true })
          || await shell.match(OFFLINE_FALLBACK)
          || new Response('BOOKNERD сейчас без сети. Подключитесь к интернету и обновите страницу.', {
            status: 503,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
      }
    })());
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetchWithTimeout(request, ASSET_TIMEOUT);
        if (response.ok && !response.redirected) {
          event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone())));
        }
        return response;
      } catch {
        return await caches.match(request, { ignoreSearch: true }) || Response.error();
      }
    })());
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch { data = { body: event.data?.text?.() || '' }; }
  const options = {
    icon: data.icon || '/booknerd-icon-v2-192.png',
    badge: data.badge || '/booknerd-icon-v2-192.png',
    data: { url: data.url || '/' },
    tag: data.topic ? `booknerd-${data.topic}` : data.chapterId ? `booknerd-${data.chapterId}` : 'booknerd-update',
    renotify: true,
  };
  if (typeof data.body === 'string' && data.body.trim()) options.body = data.body.trim();
  event.waitUntil(self.registration.showNotification(data.title || 'Новая глава в BOOKNERD ✦', options));
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
