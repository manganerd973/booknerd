import { ensureDb } from '../../../lib/runtime.js';

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function normalizeBookKey(value) {
  return String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, '-').slice(0, 140);
}

function mapPreferences(row, bookKey) {
  return {
    bookKey,
    newChapter: row ? Boolean(row.new_chapter) : false,
    translationComplete: row ? Boolean(row.translation_complete) : false,
    authorBook: row ? Boolean(row.author_book) : false,
    commentReply: row ? Boolean(row.comment_reply) : false,
    teamNews: row ? Boolean(row.team_news) : false,
  };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const visitorKey = normalizeVisitorKey(url.searchParams.get('visitorKey'));
    const bookKey = normalizeBookKey(url.searchParams.get('bookKey'));
    if (!visitorKey || !bookKey) return Response.json({ preferences: mapPreferences(null, bookKey) });
    const db = await ensureDb();
    const row = await db.prepare(
      `SELECT * FROM notification_preferences WHERE visitor_key = ? AND book_key = ? LIMIT 1`
    ).bind(visitorKey, bookKey).first();
    return Response.json({ preferences: mapPreferences(row, bookKey) });
  } catch {
    return Response.json({ preferences: mapPreferences(null, '') });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const bookKey = normalizeBookKey(payload.bookKey);
    if (!visitorKey || !bookKey) {
      return Response.json({ error: 'Не удалось сохранить настройки уведомлений.' }, { status: 400 });
    }
    const values = {
      newChapter: payload.newChapter === true,
      translationComplete: payload.translationComplete === true,
      authorBook: payload.authorBook === true,
      commentReply: payload.commentReply === true,
      teamNews: payload.teamNews === true,
    };
    const now = new Date().toISOString();
    const db = await ensureDb();
    await db.prepare(
      `INSERT INTO notification_preferences
       (visitor_key, book_key, new_chapter, translation_complete, author_book, comment_reply, team_news, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(visitor_key, book_key) DO UPDATE SET
       new_chapter = excluded.new_chapter,
       translation_complete = excluded.translation_complete,
       author_book = excluded.author_book,
       comment_reply = excluded.comment_reply,
       team_news = excluded.team_news,
       updated_at = excluded.updated_at`
    ).bind(
      visitorKey, bookKey, values.newChapter ? 1 : 0, values.translationComplete ? 1 : 0,
      values.authorBook ? 1 : 0, values.commentReply ? 1 : 0, values.teamNews ? 1 : 0, now, now,
    ).run();
    return Response.json({ ok: true, preferences: { bookKey, ...values } });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить настройки.' }, { status: 500 });
  }
}
