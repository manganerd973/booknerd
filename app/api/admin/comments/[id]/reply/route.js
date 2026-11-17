import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../lib/runtime.js';
export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const payload = await request.json();
    const body = String(payload.body || '').trim();
    if (body.length < 3 || body.length > 2000) return Response.json({ error: 'Ответ должен содержать от 3 до 2000 символов.' }, { status: 400 });
    const db = await ensureDb();
    const parent = await db.prepare("SELECT id, book_id, chapter_id FROM comments WHERE id = ? AND status = 'approved'").bind(id).first();
    if (!parent) return Response.json({ error: 'Комментарий скрыт или удалён. Сначала верните его на сайт.' }, { status: 404 });
    const replyId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO comments (id, book_id, chapter_id, parent_id, visitor_key, author_name, body, is_spoiler, is_admin, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'BOOKNERD', ?, ?, 1, 'approved', ?, ?)").bind(replyId, parent.book_id, parent.chapter_id, parent.id, 'admin:booknerd', body, payload.isSpoiler === true ? 1 : 0, now, now).run();
    return Response.json({ ok: true, id: replyId }, { status: 201 });
  } catch { return Response.json({ error: 'Не удалось отправить ответ.' }, { status: 503 }); }
}
