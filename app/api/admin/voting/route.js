import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

export async function GET(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT c.id, c.title, c.author, c.status, c.created_at, COUNT(v.visitor_key) AS votes
       FROM translation_candidates c
       LEFT JOIN translation_votes v ON v.candidate_id = c.id
       GROUP BY c.id
       ORDER BY CASE c.status WHEN 'suggested' THEN 0 WHEN 'official' THEN 1 ELSE 2 END, votes DESC, c.created_at DESC`
    ).all();
    return Response.json({
      candidates: (result.results || []).map((row) => ({
        id: row.id,
        title: row.title,
        author: row.author || '',
        status: row.status,
        votes: Number(row.votes || 0),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть голосование.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const payload = await request.json();
    const id = String(payload.id || '').trim();
    const action = String(payload.action || '').trim();
    if (!id) return Response.json({ error: 'Книга не указана.' }, { status: 400 });
    const db = await ensureDb();
    if (action === 'delete') {
      await db.prepare(`DELETE FROM translation_candidates WHERE id = ?`).bind(id).run();
      return Response.json({ ok: true });
    }
    const status = action === 'approve' ? 'official' : action === 'close' ? 'closed' : 'suggested';
    await db.prepare(`UPDATE translation_candidates SET status = ?, updated_at = ? WHERE id = ?`).bind(status, new Date().toISOString(), id).run();
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось обновить голосование.' }, { status: 500 });
  }
}
