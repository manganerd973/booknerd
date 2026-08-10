import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';

const CATEGORIES = new Set(['typo', 'gender', 'missing', 'other']);

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

export async function POST(request) {
  if (!(await hasReaderAccess(request))) {
    return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  }
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const bookId = String(payload.bookId || '').trim().slice(0, 100);
    const chapterId = String(payload.chapterId || '').trim().slice(0, 100);
    const category = CATEGORIES.has(payload.category) ? payload.category : 'other';
    const selectedText = String(payload.selectedText || '').trim().slice(0, 1000);
    const details = String(payload.details || '').trim().slice(0, 2000);
    const paragraphIndex = Math.max(0, Math.floor(Number(payload.paragraphIndex || 0)));
    const page = Math.max(0, Math.floor(Number(payload.page || 0)));
    if (!visitorKey || !bookId || !chapterId || !selectedText) {
      return Response.json({ error: 'Выделите слово или предложение.' }, { status: 400 });
    }
    const db = await ensureDb();
    const chapter = await db.prepare(`SELECT id FROM chapters WHERE id = ? AND book_id = ? LIMIT 1`).bind(chapterId, bookId).first();
    if (!chapter) return Response.json({ error: 'Глава не найдена.' }, { status: 404 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO reader_error_reports
       (id, visitor_key, book_id, chapter_id, category, selected_text, paragraph_index, page, details, status, resolved_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?)`
    ).bind(id, visitorKey, bookId, chapterId, category, selectedText, paragraphIndex, page, details, now, now).run();
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось отправить сообщение об ошибке.' }, { status: 500 });
  }
}
