import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

export async function GET(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT c.id, c.book_id, c.chapter_id, c.author_name, c.body, c.is_spoiler, c.status, c.created_at,
              b.title AS book_title, b.slug AS book_slug, ch.title AS chapter_title, ch.chapter_number
       FROM comments c
       JOIN books b ON b.id = c.book_id
       LEFT JOIN chapters ch ON ch.id = c.chapter_id
       ORDER BY CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END, c.created_at DESC
       LIMIT 300`
    ).all();
    const reviewResult = await db.prepare(
      `SELECT r.id, r.book_id, r.author_name, r.body, r.rating, r.status, r.created_at,
              b.title AS book_title, b.slug AS book_slug
       FROM book_reviews r
       JOIN books b ON b.id = r.book_id
       ORDER BY r.created_at DESC
       LIMIT 300`
    ).all();
    const reportResult = await db.prepare(
      `SELECT comment_id, reason, details, created_at FROM comment_reports ORDER BY created_at DESC LIMIT 1000`
    ).all();
    const reportsByComment = new Map();
    for (const report of reportResult.results || []) {
      const reports = reportsByComment.get(report.comment_id) || [];
      reports.push({ reason: report.reason, details: report.details || '', createdAt: report.created_at });
      reportsByComment.set(report.comment_id, reports);
    }
    const comments = (result.results || []).map((row) => ({
      kind: 'comment',
      id: row.id,
      bookId: row.book_id,
      chapterId: row.chapter_id || null,
      authorName: row.author_name,
      body: row.body,
      isSpoiler: Boolean(row.is_spoiler),
      status: row.status,
      createdAt: row.created_at,
      bookTitle: row.book_title,
      bookSlug: row.book_slug,
      chapterTitle: row.chapter_title || null,
      chapterNumber: row.chapter_number == null ? null : Number(row.chapter_number),
      reports: reportsByComment.get(row.id) || [],
    }));
    const reviews = (reviewResult.results || []).map((row) => ({
      kind: 'review',
      id: row.id,
      bookId: row.book_id,
      chapterId: null,
      authorName: row.author_name,
      body: row.body,
      rating: Number(row.rating || 0),
      isSpoiler: false,
      status: row.status,
      createdAt: row.created_at,
      bookTitle: row.book_title,
      bookSlug: row.book_slug,
      chapterTitle: null,
      chapterNumber: null,
      reports: [],
    }));
    const discussions = [...comments, ...reviews].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    return Response.json({ comments: discussions });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить комментарии.' }, { status: 503 });
  }
}
