import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

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
    const result = await (await ensureDb()).prepare(
      `SELECT email, role, created_at FROM admin_users ORDER BY created_at ASC`
    ).all();
    const team = [
      { email: 'owner', displayName: 'Владелица BOOKNERD', role: 'owner', createdAt: null },
      ...(result.results || []).map((member) => ({
        email: member.email,
        displayName: member.email,
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
    const now = new Date().toISOString();
    await (await ensureDb()).prepare(
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
    if (!email || email === 'owner') {
      return Response.json({ error: 'Доступ создателя нельзя удалить.' }, { status: 400 });
    }
    await (await ensureDb()).prepare(`DELETE FROM admin_users WHERE email = ?`).bind(email).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить участника.' }, { status: 500 });
  }
}
