import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

export async function GET(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT r.*, b.title AS book_title, b.slug AS book_slug,
              c.chapter_number, c.title AS chapter_title
       FROM reader_error_reports r
       JOIN books b ON b.id = r.book_id
       JOIN chapters c ON c.id = r.chapter_id
       ORDER BY CASE WHEN r.status = 'new' THEN 0 ELSE 1 END, r.created_at DESC
       LIMIT 500`
    ).all();
    return Response.json({
      reports: (result.results || []).map((row) => ({
        id: row.id,
        category: row.category,
        selectedText: row.selected_text,
        details: row.details || '',
        paragraphIndex: Number(row.paragraph_index || 0),
        page: Number(row.page || 0),
        status: row.status,
        resolvedBy: row.resolved_by || '',
        createdAt: row.created_at,
        bookTitle: row.book_title,
        bookSlug: row.book_slug,
        chapterId: row.chapter_id,
        chapterNumber: Number(row.chapter_number || 0),
        chapterTitle: row.chapter_title,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть сообщения об ошибках.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const payload = await request.json();
    const id = String(payload.id || '').trim();
    const status = payload.status === 'resolved' ? 'resolved' : 'new';
    if (!id) return Response.json({ error: 'Сообщение не указано.' }, { status: 400 });
    const db = await ensureDb();
    await db.prepare(
      `UPDATE reader_error_reports SET status = ?, resolved_by = ?, updated_at = ? WHERE id = ?`
    ).bind(status, status === 'resolved' ? auth.email || auth.displayName || '' : '', new Date().toISOString(), id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось обновить сообщение.' }, { status: 500 });
  }
}
