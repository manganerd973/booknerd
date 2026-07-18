import { ensureDb } from '../../../lib/runtime.js';

const VISITOR_COOKIE = 'booknerd_visitor';

function safeCookieKey(request) {
  const direct = request.cookies?.get?.(VISITOR_COOKIE)?.value || (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1) || '';
  const key = String(direct || '').trim().slice(0, 100);
  return /^[a-zA-Z0-9_-]{8,100}$/.test(key) ? key : crypto.randomUUID();
}

export async function GET(request) {
  const visitorKey = safeCookieKey(request);
  try {
    await (await ensureDb()).prepare(
      `INSERT INTO analytics_events (id, event_type, visitor_key, path, created_at) VALUES (?, 'telegram_click', ?, ?, ?)`
    ).bind(crypto.randomUUID(), visitorKey, request.headers.get('referer') || '', new Date().toISOString()).run();
  } catch {
    // The Telegram link must work even when analytics is unavailable.
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: 'https://t.me/booknerd_tr',
      'Set-Cookie': `${VISITOR_COOKIE}=${encodeURIComponent(visitorKey)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    },
  });
}
