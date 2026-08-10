import { ensureDb, getDb } from './runtime.js';

export async function listPopularComments(limit = 6) {
  if (!getDb()) return [];
  const db = await ensureDb();
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));
  const result = await db.prepare(
    `SELECT c.id, c.author_name, c.body, c.is_spoiler, c.created_at, c.chapter_id,
            b.title AS book_title, b.slug AS book_slug,
            ch.title AS chapter_title, ch.chapter_number,
            SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END) AS up_votes,
            SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END) AS down_votes
     FROM comments c
     JOIN books b ON b.id = c.book_id AND b.published = 1
     LEFT JOIN chapters ch ON ch.id = c.chapter_id
     LEFT JOIN comment_votes v ON v.comment_id = c.id
     WHERE c.status = 'approved'
       AND NOT EXISTS (SELECT 1 FROM comment_reports r WHERE r.comment_id = c.id)
     GROUP BY c.id
     HAVING COUNT(v.voter_key) > 0
     ORDER BY (SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END) - SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END)) DESC,
              COUNT(v.voter_key) DESC, c.created_at DESC
     LIMIT ?`
  ).bind(safeLimit).all();
  return (result.results || []).map((row) => ({
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    isSpoiler: Boolean(row.is_spoiler),
    createdAt: row.created_at,
    bookTitle: row.book_title,
    bookSlug: row.book_slug,
    chapterId: row.chapter_id || null,
    chapterTitle: row.chapter_title || null,
    chapterNumber: row.chapter_number == null ? null : Number(row.chapter_number),
    upVotes: Number(row.up_votes || 0),
    downVotes: Number(row.down_votes || 0),
  }));
}
