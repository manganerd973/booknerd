import { ensureDb } from '../../../lib/runtime.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

export async function GET(request) {
  try {
    const visitorKey = normalizeVisitorKey(new URL(request.url).searchParams.get('visitorKey'));
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT c.id, c.title, c.author, c.status, COUNT(v.visitor_key) AS votes,
              MAX(CASE WHEN v.visitor_key = ? THEN 1 ELSE 0 END) AS voted
       FROM translation_candidates c
       LEFT JOIN translation_votes v ON v.candidate_id = c.id
       WHERE c.status = 'official'
       GROUP BY c.id
       ORDER BY votes DESC, c.created_at ASC`
    ).bind(visitorKey || '__none__').all();
    return Response.json({
      candidates: (result.results || []).map((row) => ({
        id: row.id,
        title: row.title,
        author: row.author || '',
        votes: Number(row.votes || 0),
        voted: Boolean(row.voted),
      })),
    });
  } catch {
    return Response.json({ candidates: [] });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    if (!visitorKey) return Response.json({ error: 'Не удалось определить читателя.' }, { status: 400 });
    const db = await ensureDb();
    const now = new Date().toISOString();
    if (payload.action === 'suggest') {
      const title = String(payload.title || '').trim().slice(0, 220);
      const author = String(payload.author || '').trim().slice(0, 180);
      if (title.length < 2) return Response.json({ error: 'Укажите название книги.' }, { status: 400 });
      const id = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO translation_candidates (id, title, author, suggested_by, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'suggested', ?, ?)`
      ).bind(id, title, author, visitorKey, now, now).run();
      return Response.json({ ok: true, id }, { status: 201 });
    }
    const candidateId = String(payload.candidateId || '').trim();
    const candidate = await db.prepare(`SELECT id FROM translation_candidates WHERE id = ? AND status = 'official' LIMIT 1`).bind(candidateId).first();
    if (!candidate) return Response.json({ error: 'Вариант голосования не найден.' }, { status: 404 });
    const current = await db.prepare(`SELECT candidate_id FROM translation_votes WHERE candidate_id = ? AND visitor_key = ? LIMIT 1`).bind(candidateId, visitorKey).first();
    if (current) {
      await db.prepare(`DELETE FROM translation_votes WHERE candidate_id = ? AND visitor_key = ?`).bind(candidateId, visitorKey).run();
      return Response.json({ ok: true, voted: false });
    }
    await db.prepare(`INSERT INTO translation_votes (candidate_id, visitor_key, created_at) VALUES (?, ?, ?)`).bind(candidateId, visitorKey, now).run();
    return Response.json({ ok: true, voted: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось отправить голос.' }, { status: 500 });
  }
}
