import { ensureDb } from '../../../../lib/runtime.js';

function safeKey(value) {
  const key = String(value || '').trim().slice(0, 100);
  return /^[a-zA-Z0-9_-]{8,100}$/.test(key) ? key : '';
}

export async function POST(request) {
  try {
    const input = await request.json();
    const visitorKey = safeKey(input.visitorKey);
    if (!visitorKey) return Response.json({ error: 'Не удалось определить читателя.' }, { status: 400 });
    const now = new Date().toISOString();
    await (await ensureDb()).prepare(
      `INSERT INTO reader_presence (visitor_key, book_id, chapter_id, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(visitor_key) DO UPDATE SET book_id = excluded.book_id, chapter_id = excluded.chapter_id, updated_at = excluded.updated_at`
    ).bind(visitorKey, String(input.bookId || '').slice(0, 100), String(input.chapterId || '').slice(0, 100), now).run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Не удалось обновить счётчик.' }, { status: 503 });
  }
}
