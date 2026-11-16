'use client';

const VISITOR_STORAGE_KEY = 'booknerd-visitor-v1';
const VISITOR_COOKIE = 'booknerd_visitor';

export function getVisitorKey() {
  let key = '';
  try { key = localStorage.getItem(VISITOR_STORAGE_KEY) || ''; } catch { /* Storage can be disabled. */ }
  if (!key) {
    key = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `reader-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    try { localStorage.setItem(VISITOR_STORAGE_KEY, key); } catch { /* Cookie still keeps the key. */ }
  }
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  try { document.cookie = `${VISITOR_COOKIE}=${encodeURIComponent(key)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`; } catch { /* Analytics remains optional. */ }
  return key;
}

async function postAnalytics(path, payload) {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorKey: getVisitorKey(), ...payload }),
      keepalive: true,
    });
  } catch {
    // Reading must never be interrupted by analytics.
  }
}

export function trackReaderPresence(bookId, chapterId) {
  return postAnalytics('/api/analytics/presence', { bookId, chapterId });
}

export function trackSiteInstall(source = 'standalone') {
  const platform = typeof navigator !== 'undefined'
    ? String(navigator.userAgentData?.platform || navigator.platform || 'unknown').slice(0, 80)
    : 'unknown';
  return postAnalytics('/api/analytics/install', { source, platform });
}
