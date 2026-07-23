import { buildPushPayload } from '@block65/webcrypto-web-push';
import { ensureDb } from './runtime.js';

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const [privateJwk, publicJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.privateKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
  ]);
  const x = base64UrlToBytes(publicJwk.x);
  const y = base64UrlToBytes(publicJwk.y);
  const publicBytes = new Uint8Array(65);
  publicBytes[0] = 4;
  publicBytes.set(x, 1);
  publicBytes.set(y, 33);
  return { publicKey: bytesToBase64Url(publicBytes), privateKey: privateJwk.d };
}

export async function getOrCreateVapidKeys() {
  const db = await ensureDb();
  let row = await db.prepare(`SELECT public_key, private_key FROM vapid_config WHERE id = 'default' LIMIT 1`).first();
  if (!row) {
    const generated = await generateVapidKeys();
    await db.prepare(
      `INSERT OR IGNORE INTO vapid_config (id, public_key, private_key, created_at) VALUES ('default', ?, ?, ?)`
    ).bind(generated.publicKey, generated.privateKey, new Date().toISOString()).run();
    row = await db.prepare(`SELECT public_key, private_key FROM vapid_config WHERE id = 'default' LIMIT 1`).first();
  }
  return { publicKey: row.public_key, privateKey: row.private_key };
}

async function sendToSubscription(subscription, message, vapid) {
  const payload = await buildPushPayload(
    { data: message, options: { ttl: 86400, urgency: 'high', topic: `chapter-${message.chapterId.slice(0, 20)}` } },
    {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    vapid,
  );
  return fetch(subscription.endpoint, payload);
}

export async function notifyPublishedChapter({ chapterId, requestUrl }) {
  const db = await ensureDb();
  const chapter = await db.prepare(
    `SELECT c.id, c.chapter_number, c.title AS chapter_title, c.status, b.id AS book_id, b.slug, b.title AS book_title
     FROM chapters c JOIN books b ON b.id = c.book_id
     WHERE c.id = ? AND c.status = 'published' AND b.published = 1 LIMIT 1`
  ).bind(chapterId).first();
  if (!chapter) return { sent: 0 };

  const claimed = await db.prepare(
    `INSERT OR IGNORE INTO push_announcements (chapter_id, sent_at) VALUES (?, ?)`
  ).bind(chapter.id, new Date().toISOString()).run();
  if (!Number(claimed.meta?.changes || 0)) return { sent: 0, duplicate: true };

  const subscriptionsResult = await db.prepare(
    `SELECT endpoint, visitor_key, p256dh, auth FROM push_subscriptions ORDER BY updated_at DESC`
  ).all();
  const subscriptions = subscriptionsResult.results || [];
  if (!subscriptions.length) return { sent: 0 };

  const keys = await getOrCreateVapidKeys();
  const origin = new URL(requestUrl).origin;
  const vapid = { subject: origin, publicKey: keys.publicKey, privateKey: keys.privateKey };
  const message = {
    title: 'Новая глава в BOOKNERD ✦',
    body: `«${chapter.book_title}» — глава ${chapter.chapter_number}: ${chapter.chapter_title}`,
    url: `/books/${chapter.slug}/chapters/${chapter.id}`,
    icon: '/booknerd-icon-v2-192.png',
    badge: '/booknerd-icon-v2-192.png',
    chapterId: chapter.id,
    bookId: chapter.book_id,
  };

  let sent = 0;
  for (let index = 0; index < subscriptions.length; index += 25) {
    const batch = subscriptions.slice(index, index + 25);
    const results = await Promise.allSettled(batch.map(async (subscription) => {
      const response = await sendToSubscription(subscription, message, vapid);
      if (response.status === 404 || response.status === 410) {
        await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(subscription.endpoint).run();
      }
      if (!response.ok) throw new Error(`Push service returned ${response.status}`);
      return true;
    }));
    sent += results.filter((result) => result.status === 'fulfilled').length;
  }
  return { sent };
}
