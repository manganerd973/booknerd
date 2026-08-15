import { ensureDb } from '../../../../../lib/runtime.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

export async function GET(request, { params }) {
  try {
    const { id: bookId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const visitorKey = normalizeVisitorKey(searchParams.get('visitorKey'));
    const currentChapterId = String(searchParams.get('chapterId') || '').trim().slice(0, 100);
    const db = await ensureDb();
    let unlockedChapter = 0;
    if (visitorKey) {
      const progress = await db.prepare(
        `SELECT COALESCE(c.chapter_number, 0) AS chapter_number
         FROM reader_library rl
         LEFT JOIN chapters c ON c.id = rl.last_chapter_id
         WHERE rl.visitor_key = ? AND rl.book_id = ?
         LIMIT 1`
      ).bind(visitorKey, bookId).first();
      unlockedChapter = Math.max(0, Number(progress?.chapter_number || 0));
    }
    if (currentChapterId) {
      const currentChapter = await db.prepare(
        `SELECT chapter_number FROM chapters
         WHERE id = ? AND book_id = ? AND status = 'published'
         LIMIT 1`
      ).bind(currentChapterId, bookId).first();
      unlockedChapter = Math.max(unlockedChapter, Number(currentChapter?.chapter_number || 0));
    }
    const result = await db.prepare(
      `SELECT id, category, name, pronunciation, description, connections, reveal_after_chapter, sort_order
       FROM book_glossary
       WHERE book_id = ? AND reveal_after_chapter <= ?
       ORDER BY sort_order ASC, name COLLATE NOCASE ASC`
    ).bind(bookId, unlockedChapter).all();
    const total = await db.prepare(`SELECT COUNT(*) AS count FROM book_glossary WHERE book_id = ?`).bind(bookId).first();
    return Response.json({
      unlockedChapter,
      total: Number(total?.count || 0),
      entries: (result.results || []).map((row) => ({
        id: row.id,
        category: row.category,
        name: row.name,
        pronunciation: row.pronunciation || '',
        description: row.description || '',
        connections: row.connections || '',
        revealAfterChapter: Number(row.reveal_after_chapter || 0),
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Словарь временно недоступен.' }, { status: 503 });
  }
}
