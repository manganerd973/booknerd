import { hasReaderAccess } from '../../../../../lib/reader-access.js';
import { ensureDb } from '../../../../../lib/runtime.js';

export async function POST(request, { params }) {
  if (!(await hasReaderAccess(request))) {
    return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const payload = await request.json();
    const voterKey = String(payload.voterKey || '').trim();
    const value = Number(payload.value);
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(voterKey) || ![1, -1].includes(value)) {
      return Response.json({ error: 'Не удалось сохранить голос.' }, { status: 400 });
    }

    const db = await ensureDb();
    const comment = await db.prepare(
      `SELECT c.id FROM comments c JOIN books b ON b.id = c.book_id
       WHERE c.id = ? AND c.status = 'approved' AND b.published = 1 LIMIT 1`
    ).bind(id).first();
    if (!comment) return Response.json({ error: 'Комментарий не найден.' }, { status: 404 });

    const existing = await db.prepare(
      `SELECT value FROM comment_votes WHERE comment_id = ? AND voter_key = ? LIMIT 1`
    ).bind(id, voterKey).first();
    const now = new Date().toISOString();
    let currentVote = value;
    if (existing && Number(existing.value) === value) {
      await db.prepare(`DELETE FROM comment_votes WHERE comment_id = ? AND voter_key = ?`).bind(id, voterKey).run();
      currentVote = 0;
    } else if (existing) {
      await db.prepare(`UPDATE comment_votes SET value = ?, updated_at = ? WHERE comment_id = ? AND voter_key = ?`).bind(value, now, id, voterKey).run();
    } else {
      await db.prepare(
        `INSERT INTO comment_votes (comment_id, voter_key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      ).bind(id, voterKey, value, now, now).run();
    }

    const counts = await db.prepare(
      `SELECT SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS up_votes,
              SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS down_votes
       FROM comment_votes WHERE comment_id = ?`
    ).bind(id).first();
    return Response.json({
      vote: currentVote,
      upVotes: Number(counts?.up_votes || 0),
      downVotes: Number(counts?.down_votes || 0),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить голос.' }, { status: 500 });
  }
}
