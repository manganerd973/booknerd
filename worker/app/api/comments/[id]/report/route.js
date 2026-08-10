import { hasReaderAccess } from '../../../../../lib/reader-access.js';
import { ensureDb } from '../../../../../lib/runtime.js';

const allowedReasons = new Set(['spam', 'insult', 'spoiler', 'inappropriate', 'other']);

export async function POST(request, { params }) {
  if (!(await hasReaderAccess(request))) {
    return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const payload = await request.json();
    const voterKey = String(payload.voterKey || '').trim();
    const reason = String(payload.reason || '').trim();
    const details = String(payload.details || '').trim().slice(0, 1000);
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(voterKey) || !allowedReasons.has(reason)) {
      return Response.json({ error: 'Выберите причину жалобы.' }, { status: 400 });
    }
    if (reason === 'other' && details.length < 3) {
      return Response.json({ error: 'Коротко опишите причину жалобы.' }, { status: 400 });
    }

    const db = await ensureDb();
    const comment = await db.prepare(
      `SELECT c.id FROM comments c JOIN books b ON b.id = c.book_id
       WHERE c.id = ? AND c.status = 'approved' AND b.published = 1 LIMIT 1`
    ).bind(id).first();
    if (!comment) return Response.json({ error: 'Комментарий не найден.' }, { status: 404 });

    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO comment_reports (comment_id, voter_key, reason, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(comment_id, voter_key) DO UPDATE SET
         reason = excluded.reason, details = excluded.details, updated_at = excluded.updated_at`
    ).bind(id, voterKey, reason, details, now, now).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось отправить жалобу.' }, { status: 500 });
  }
}
