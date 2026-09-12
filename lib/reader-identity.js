import { getOwnerPassword } from './runtime.js';

export const READER_IDENTITY_COOKIE = 'booknerd_xp_identity';

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

async function signature(visitorKey) {
  const secret = getOwnerPassword();
  if (!secret) return '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`booknerd-reader-xp:${visitorKey}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyOrCreateReaderIdentity(request, visitorKey) {
  const expected = await signature(visitorKey);
  if (!expected) return { valid: true, setCookie: '' };
  const value = readCookie(request, READER_IDENTITY_COOKIE);
  if (value) {
    const separator = value.lastIndexOf('.');
    const boundKey = separator > 0 ? value.slice(0, separator) : '';
    const boundSignature = separator > 0 ? value.slice(separator + 1) : '';
    return { valid: boundKey === visitorKey && boundSignature === expected, setCookie: '' };
  }
  return {
    valid: true,
    setCookie: `${READER_IDENTITY_COOKIE}=${encodeURIComponent(`${visitorKey}.${expected}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
  };
}

export function jsonWithReaderIdentity(payload, identity, init = {}) {
  const response = Response.json(payload, init);
  if (identity?.setCookie) response.headers.append('set-cookie', identity.setCookie);
  return response;
}
