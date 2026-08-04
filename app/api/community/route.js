import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';

const KINDS = new Set(['club', 'readalong', 'poll', 'theory']);

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

function mapPost(row, visitorKey) {
  return {
    id: row.id,
    kind: row.kind,
    authorName: row.author_name,
    title: row.title,
    body: row.body,
    isSpoiler: Boolean(row.is_spoiler),
    createdAt: row.created_at,
    bookId: row.book_id || '',
    bookTitle: row.book_title || '',
    bookSlug: row.book_slug || '',
    votes: Number(row.votes || 0),
    voted: Boolean(row.my_vote),
    mine: row.visitor_key === visitorKey,
  };
}

export async function GET(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const visitorKey = normalizeVisitorKey(url.searchParams.get('visitorKey'));
    const kind = KINDS.has(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
    const db = await ensureDb();
    const result = await db.prepare(`SELECT p.*, b.title AS book_title, b.slug AS book_slug,
      COUNT(v.visitor_key) AS votes,
      MAX(CASE WHEN v.visitor_key = ? THEN 1 ELSE 0 END) AS my_vote
      FROM community_posts p
      LEFT JOIN books b ON b.id = p.book_id
      LEFT JOIN community_votes v ON v.post_id = p.id
      WHERE p.status = 'approved' ${kind ? 'AND p.kind = ?' : ''}
      GROUP BY p.id ORDER BY votes DESC, p.created_at DESC LIMIT 120`)
      .bind(...(kind ? [visitorKey, kind] : [visitorKey])).all();
    return Response.json({ posts: (result.results || []).map((row) => mapPost(row, visitorKey)) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть сообщество.' }, { status: 503 });
  }
}

export async function POST(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    const db = await ensureDb();
    const now = new Date().toISOString();

    if (payload.action === 'vote') {
      const postId = String(payload.postId || '').trim();
      const existing = await db.prepare(`SELECT post_id FROM community_votes WHERE post_id = ? AND visitor_key = ? LIMIT 1`).bind(postId, visitorKey).first();
      if (existing) await db.prepare(`DELETE FROM community_votes WHERE post_id = ? AND visitor_key = ?`).bind(postId, visitorKey).run();
      else await db.prepare(`INSERT INTO community_votes (post_id, visitor_key, created_at) VALUES (?, ?, ?)`).bind(postId, visitorKey, now).run();
      const total = await db.prepare(`SELECT COUNT(*) AS total FROM community_votes WHERE post_id = ?`).bind(postId).first();
      return Response.json({ ok: true, voted: !existing, votes: Number(total?.total || 0) });
    }

    const kind = KINDS.has(payload.kind) ? payload.kind : 'theory';
    const authorName = String(payload.authorName || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const title = String(payload.title || '').trim().slice(0, 240);
    const body = String(payload.body || '').trim().slice(0, 6000);
    const bookId = String(payload.bookId || '').trim() || null;
    if (authorName.length < 2 || title.length < 3) return Response.json({ error: 'Укажите имя и название.' }, { status: 400 });
    if (bookId) {
      const book = await db.prepare(`SELECT id FROM books WHERE id = ? AND published = 1 LIMIT 1`).bind(bookId).first();
      if (!book) return Response.json({ error: 'Книга не найдена.' }, { status: 404 });
    }
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO community_posts (id, visitor_key, book_id, kind, author_name, title, body, is_spoiler, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`)
      .bind(id, visitorKey, bookId, kind, authorName, title, body, payload.isSpoiler ? 1 : 0, now, now).run();
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить публикацию.' }, { status: 500 });
  }
}
