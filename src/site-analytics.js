'use client';

const VISITOR_STORAGE_KEY = 'booknerd-visitor-v1';
const VISITOR_COOKIE = 'booknerd_visitor';

function validVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function readVisitorCookie() {
  if (typeof document === 'undefined') return '';
  const prefix = `${VISITOR_COOKIE}=`;
  const item = String(document.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!item) return '';
  try { return validVisitorKey(decodeURIComponent(item.slice(prefix.length))); } catch { return ''; }
}

export function getVisitorKey() {
  let key = '';
  try { key = validVisitorKey(localStorage.getItem(VISITOR_STORAGE_KEY)); } catch { /* Storage can be disabled. */ }
  if (!key) key = readVisitorCookie();
  if (!key) {
    key = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `reader-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  try { localStorage.setItem(VISITOR_STORAGE_KEY, key); } catch { /* Cookie still keeps the key stable. */ }
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
