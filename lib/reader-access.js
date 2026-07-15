import { env } from 'cloudflare:workers';

export const READER_ACCESS_COOKIE = 'booknerd_reader_access';

export function getReaderPassword() {
  const localPassword = typeof process !== 'undefined'
    ? process.env?.BOOKNERD_READER_PASSWORD
    : '';

  return String(env.BOOKNERD_READER_PASSWORD || localPassword || '').trim();
}

export async function createReaderAccessToken(password) {
  const bytes = new TextEncoder().encode(`booknerd-reader:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hasReaderAccess(request) {
  const password = getReaderPassword();
  if (!password) return false;

  const cookie = request.cookies.get(READER_ACCESS_COOKIE)?.value || '';
  const expected = await createReaderAccessToken(password);
  return cookie === expected;
}
