import { getOwnerEmail, requireDb } from './runtime.js';

export function requestUserEmail(request) {
  return String(request.headers.get('oai-authenticated-user-email') || '').trim().toLowerCase();
}

export async function getAdminRole(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === getOwnerEmail()) return 'owner';

  try {
    const db = requireDb();
    const row = await db.prepare(`SELECT role FROM admin_users WHERE email = ? LIMIT 1`).bind(normalized).first();
    return row?.role || null;
  } catch {
    return null;
  }
}

export async function authorizeAdminRequest(request, { ownerOnly = false } = {}) {
  const email = requestUserEmail(request);
  if (!email) {
    return { response: Response.json({ error: 'Войдите в аккаунт, чтобы продолжить.' }, { status: 401 }) };
  }
  const role = await getAdminRole(email);
  if (!role || (ownerOnly && role !== 'owner')) {
    return { response: Response.json({ error: 'У вас нет доступа к этой панели.' }, { status: 403 }) };
  }
  return { email, role };
}
