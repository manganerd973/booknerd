import { hasReaderAccess } from '../../../../../lib/reader-access.js';
import { richDocumentToPlainText } from '../../../../../lib/rich-document.js';
import { ensureDb } from '../../../../../lib/runtime.js';

function cleanQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function excerpt(text, needle) {
  const haystack = String(text || '');
  const normalized = haystack.toLocaleLowerCase('ru-RU');
  const position = normalized.indexOf(needle);
  if (position < 0) return '';
  const start = Math.max(0, position - 90);
  const end = Math.min(haystack.length, position + needle.length + 150);
  return `${start > 0 ? '…' : ''}${haystack.slice(start, end).replace(/\s+/g, ' ')}${end < haystack.length ? '…' : ''}`;
}

export async function GET(request, { params }) {
  if (!await hasReaderAccess(request)) {
    return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  }
  try {
    const { id: bookId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const query = cleanQuery(searchParams.get('q'));
    const currentChapterId = String(searchParams.get('chapterId') || '').trim().slice(0, 100);
    if (query.length < 2) return Response.json({ results: [] });
    if (!currentChapterId) return Response.json({ error: 'Не удалось определить открытую главу.' }, { status: 400 });

    const db = await ensureDb();
    const current = await db.prepare(
      `SELECT chapter_number FROM chapters
       WHERE id = ? AND book_id = ? AND status = 'published'
       LIMIT 1`
    ).bind(currentChapterId, bookId).first();
    if (!current) return Response.json({ error: 'Открытая глава недоступна.' }, { status: 404 });

    const rows = await db.prepare(
      `SELECT id, chapter_number, title, body, body_rich
       FROM chapters
       WHERE book_id = ? AND status = 'published' AND chapter_number <= ?
       ORDER BY chapter_number ASC
       LIMIT 250`
    ).bind(bookId, Number(current.chapter_number || 0)).all();
    const needle = query.toLocaleLowerCase('ru-RU');
    const results = [];
    for (const row of rows.results || []) {
      const body = String(row.body || '').trim() || richDocumentToPlainText(row.body_rich || '');
      const inTitle = String(row.title || '').toLocaleLowerCase('ru-RU').includes(needle);
      const snippet = excerpt(body, needle);
      if (!inTitle && !snippet) continue;
      results.push({
        id: row.id,
        chapterNumber: Number(row.chapter_number || 0),
        title: row.title || '',
        snippet: snippet || row.title || '',
      });
      if (results.length >= 30) break;
    }
    return Response.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Поиск временно недоступен.' }, { status: 503 });
  }
}
