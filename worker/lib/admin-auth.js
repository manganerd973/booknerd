import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureDb, getOwnerPassword, getTeamPassword } from './runtime.js';

export const ADMIN_SESSION_COOKIE = 'booknerd_admin_session';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function readCookie(request, name) {
  const direct = request.cookies?.get?.(name)?.value;
  if (direct) return direct;
  const cookieHeader = request.headers.get('cookie') || '';
  const part = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return part ? part.slice(name.length + 1) : '';
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function memberExists(email) {
  try {
    const row = await (await ensureDb()).prepare(
      `SELECT email FROM admin_users WHERE email = ? AND role = 'editor' LIMIT 1`
    ).bind(email).first();
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function createAdminSessionToken(role, email, password) {
  const identity = role === 'owner' ? 'owner' : normalizeEmail(email);
  const signature = await digest(`booknerd-admin:${role}:${identity}:${password}`);
  return `${role}|${encodeURIComponent(identity)}|${signature}`;
}

export async function verifyAdminSessionToken(token) {
  const [role, encodedIdentity, signature, ...rest] = String(token || '').split('|');
  if (rest.length || !signature || !['owner', 'editor'].includes(role)) return null;

  let identity = '';
  try { identity = decodeURIComponent(encodedIdentity); } catch { return null; }
  const password = role === 'owner' ? getOwnerPassword() : getTeamPassword();
  if (!password) return null;

  const expected = await createAdminSessionToken(role, identity, password);
  if (expected !== token) return null;
  if (role === 'editor' && !(await memberExists(identity))) return null;

  return {
    role,
    email: role === 'owner' ? 'owner' : identity,
    displayName: role === 'owner' ? 'Владелица' : identity,
  };
}

export async function authenticateAdmin(password, email = '') {
  if (getOwnerPassword() && password === getOwnerPassword()) {
    return {
      role: 'owner',
      email: 'owner',
      displayName: 'Владелица',
      token: await createAdminSessionToken('owner', 'owner', getOwnerPassword()),
    };
  }

  const normalized = normalizeEmail(email);
  if (normalized && getTeamPassword() && password === getTeamPassword() && await memberExists(normalized)) {
    return {
      role: 'editor',
      email: normalized,
      displayName: normalized,
      token: await createAdminSessionToken('editor', normalized, getTeamPassword()),
    };
  }

  return null;
}

export async function getAdminSessionFromRequest(request) {
  return verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE));
}

export async function requireAdminSession(returnTo = '/admin') {
  const cookieStore = await cookies();
  const session = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value || '');
  if (session) return session;
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/admin';
  redirect(`/admin/login?next=${encodeURIComponent(safeReturnTo)}`);
}

export async function getAdminRole(email) {
  if (email === 'owner') return 'owner';
  return memberExists(normalizeEmail(email)) ? 'editor' : null;
}

export async function authorizeAdminRequest(request, { ownerOnly = false } = {}) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return { response: Response.json({ error: 'Войдите в панель управления.' }, { status: 401 }) };
  }
  if (ownerOnly && session.role !== 'owner') {
    return { response: Response.json({ error: 'Это действие доступно только владелице.' }, { status: 403 }) };
  }
  return session;
}
