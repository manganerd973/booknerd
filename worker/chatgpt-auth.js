import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

const USER_EMAIL_HEADER = 'oai-authenticated-user-email';
const USER_FULL_NAME_HEADER = 'oai-authenticated-user-full-name';
const USER_FULL_NAME_ENCODING_HEADER = 'oai-authenticated-user-full-name-encoding';

export async function getChatGPTUser() {
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedName = requestHeaders.get(USER_FULL_NAME_HEADER);
  let fullName = null;
  if (encodedName && requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === 'percent-encoded-utf-8') {
    try { fullName = decodeURIComponent(encodedName); } catch { fullName = null; }
  }

  return {
    email: email.trim().toLowerCase(),
    displayName: fullName || email,
  };
}

export async function requireChatGPTUser(returnTo = '/admin') {
  const user = await getChatGPTUser();
  if (user) return user;
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/admin';
  redirect(`/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`);
}

export function signOutPath(returnTo = '/') {
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return `/signout-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}
