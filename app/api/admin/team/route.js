import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { getOwnerEmail, requireDb } from '../../../../lib/runtime.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const result = await requireDb().prepare(
      `SELECT email, role, created_at FROM admin_users ORDER BY created_at ASC`
    ).all();
    const ownerEmail = getOwnerEmail();
    const team = [
      ...(ownerEmail ? [{ email: ownerEmail, role: 'owner', createdAt: null }] : []),
      ...(result.results || []).filter((member) => member.email !== ownerEmail).map((member) => ({
        email: member.email,
        role: member.role,
        createdAt: member.created_at,
      })),
    ];
    return Response.json({ team });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
}

export async function POST(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const payload = await request.json();
    const email = normalizeEmail(payload.email);
    if (!validEmail(email)) return Response.json({ error: 'Введите корректный email.' }, { status: 400 });
    if (email === getOwnerEmail()) return Response.json({ error: 'Создатель уже имеет полный доступ.' }, { status: 400 });
    const now = new Date().toISOString();
    await requireDb().prepare(
      `INSERT INTO admin_users (email, role, created_at, invited_by)
       VALUES (?, 'editor', ?, ?)
       ON CONFLICT(email) DO UPDATE SET role = 'editor'`
    ).bind(email, now, auth.email).run();
    return Response.json({ email, role: 'editor', createdAt: now }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось добавить участника.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const { email: value } = await request.json();
    const email = normalizeEmail(value);
    if (!email || email === getOwnerEmail()) {
      return Response.json({ error: 'Доступ создателя нельзя удалить.' }, { status: 400 });
    }
    await requireDb().prepare(`DELETE FROM admin_users WHERE email = ?`).bind(email).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить участника.' }, { status: 500 });
  }
}
