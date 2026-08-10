import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const READER_ACCESS_COOKIE = 'booknerd_reader_access';

function readRuntimeValue(name) {
  const localValue = typeof process !== 'undefined' ? process.env?.[name] : '';
  let workerValue = '';
  try {
    workerValue = env?.[name] || '';
  } catch {
    // Some local and preview runtimes expose no Cloudflare environment object.
  }
  return String(workerValue || localValue || '').trim();
}

export function isReaderAccessEnabled() {
  return /^(1|true|yes|on)$/i.test(readRuntimeValue('BOOKNERD_READER_ACCESS_ENABLED'));
}

export function getReaderPassword() {
  return readRuntimeValue('BOOKNERD_READER_PASSWORD');
}

export async function createReaderAccessToken(password) {
  const bytes = new TextEncoder().encode(`booknerd-reader:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hasReaderAccess(request) {
  const password = getReaderPassword();
  // Reader access is public by default. A leftover password alone must not
  // lock the whole website; the gate is enabled only by the explicit flag.
  if (!isReaderAccessEnabled() || !password) return true;

  const cookie = request.cookies.get(READER_ACCESS_COOKIE)?.value || '';
  const expected = await createReaderAccessToken(password);
  return cookie === expected;
}

export async function requireReaderAccess(nextPath = '/') {
  const password = getReaderPassword();
  if (!isReaderAccessEnabled() || !password) return;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(READER_ACCESS_COOKIE)?.value || '';
  const expected = await createReaderAccessToken(password);

  if (cookie !== expected) {
    redirect(`/reader-access?next=${encodeURIComponent(nextPath)}`);
  }
}
