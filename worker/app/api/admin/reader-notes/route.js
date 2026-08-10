import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

export async function GET(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const result = await (await ensureDb()).prepare(
      `SELECT n.*, b.title AS book_title, b.slug AS book_slug,
              c.title AS chapter_title, c.chapter_number
       FROM reader_public_notes n
       JOIN books b ON b.id = n.book_id
       JOIN chapters c ON c.id = n.chapter_id
       ORDER BY n.is_pinned DESC,
                CASE n.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                n.updated_at DESC
       LIMIT 500`
    ).all();
    const notes = (result.results || []).map((row) => ({
      id: row.id,
      authorName: row.author_name || 'Читатель BOOKNERD',
      quote: row.quote || '',
      note: row.note || '',
      bookTitle: row.book_title || '',
      bookSlug: row.book_slug || '',
      chapterId: row.chapter_id,
      chapterTitle: row.chapter_title || '',
      chapterNumber: Number(row.chapter_number || 0),
      paragraphIndex: Number(row.paragraph_index || 0),
      page: Number(row.page || 0),
      isSpoiler: Boolean(row.is_spoiler),
      status: row.status || 'pending',
      isPinned: Boolean(row.is_pinned),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return Response.json({ notes });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить заметки.' }, { status: 503 });
  }
}
