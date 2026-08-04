import { hasReaderAccess } from '../../../lib/reader-access.js';
import { ensureDb } from '../../../lib/runtime.js';

const EMOTIONS = new Set(['😭', '😍', '😡', '😱', '🤍']);
const THEMES = new Set(['original', 'white', 'black', 'system']);
const ATMOSPHERES = new Set(['auto', 'none', 'spring', 'summer', 'autumn', 'winter']);

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function parseList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanList(value, limit = 30, itemLimit = 500) {
  return (Array.isArray(value) ? value : []).map((item) => String(item || '').trim().slice(0, itemLimit)).filter(Boolean).slice(0, limit);
}

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

export async function GET(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const visitorKey = normalizeVisitorKey(url.searchParams.get('visitorKey'));
    const bookId = String(url.searchParams.get('bookId') || '').trim();
    const chapterId = String(url.searchParams.get('chapterId') || '').trim();
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    const db = await ensureDb();
    const [profile, dictionary, reactions, capsules, emotionTotals, myEmotions] = await Promise.all([
      db.prepare(`SELECT * FROM reader_profiles WHERE visitor_key = ? LIMIT 1`).bind(visitorKey).first(),
      db.prepare(`SELECT d.*, b.title AS book_title, b.slug AS book_slug, c.title AS chapter_title, c.chapter_number
        FROM reader_dictionary d JOIN books b ON b.id = d.book_id JOIN chapters c ON c.id = d.chapter_id
        WHERE d.visitor_key = ? ${bookId ? 'AND d.book_id = ?' : ''} ORDER BY d.created_at DESC LIMIT 300`)
        .bind(...(bookId ? [visitorKey, bookId] : [visitorKey])).all(),
      chapterId
        ? db.prepare(`SELECT r.*, COUNT(*) OVER (PARTITION BY r.chapter_id, r.paragraph_index, r.emoji) AS total
            FROM paragraph_reactions r WHERE r.chapter_id = ? ORDER BY r.paragraph_index, r.created_at`).bind(chapterId).all()
        : Promise.resolve({ results: [] }),
      db.prepare(`SELECT t.*, b.title AS book_title, b.slug AS book_slug FROM reader_time_capsules t JOIN books b ON b.id = t.book_id WHERE t.visitor_key = ? ORDER BY t.updated_at DESC`).bind(visitorKey).all(),
      bookId
        ? db.prepare(`SELECT chapter_id, emoji, COUNT(*) AS total FROM chapter_emotions WHERE book_id = ? GROUP BY chapter_id, emoji`).bind(bookId).all()
        : Promise.resolve({ results: [] }),
      bookId
        ? db.prepare(`SELECT chapter_id, emoji FROM chapter_emotions WHERE visitor_key = ? AND book_id = ?`).bind(visitorKey, bookId).all()
        : Promise.resolve({ results: [] }),
    ]);
    return Response.json({
      profile: profile ? {
        displayName: profile.display_name,
        banner: profile.banner,
        favoriteCharacters: parseList(profile.favorite_characters),
        favoriteQuotes: parseList(profile.favorite_quotes),
        appTheme: THEMES.has(profile.app_theme) ? profile.app_theme : 'original',
        atmosphere: ATMOSPHERES.has(profile.atmosphere) ? profile.atmosphere : 'auto',
      } : null,
      dictionary: dictionary.results || [],
      reactions: reactions.results || [],
      capsules: capsules.results || [],
      emotionTotals: emotionTotals.results || [],
      myEmotions: myEmotions.results || [],
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть данные читателя.' }, { status: 503 });
  }
}

export async function POST(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const payload = await request.json();
    const visitorKey = normalizeVisitorKey(payload.visitorKey);
    const action = String(payload.action || '').trim();
    if (!visitorKey) return Response.json({ error: 'Читатель не определён.' }, { status: 400 });
    const db = await ensureDb();
    const now = new Date().toISOString();

    if (action === 'profile') {
      const displayName = String(payload.displayName || 'Читатель BOOKNERD').trim().replace(/\s+/g, ' ').slice(0, 60) || 'Читатель BOOKNERD';
      const banner = ['books', 'stars', 'forest', 'archive', 'garden'].includes(payload.banner) ? payload.banner : 'books';
      const appTheme = THEMES.has(payload.appTheme) ? payload.appTheme : 'original';
      const atmosphere = ATMOSPHERES.has(payload.atmosphere) ? payload.atmosphere : 'auto';
      const favoriteCharacters = cleanList(payload.favoriteCharacters, 30, 120);
      const favoriteQuotes = cleanList(payload.favoriteQuotes, 50, 1000);
      await db.prepare(`INSERT INTO reader_profiles
        (visitor_key, display_name, banner, favorite_characters, favorite_quotes, app_theme, atmosphere, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(visitor_key) DO UPDATE SET display_name = excluded.display_name, banner = excluded.banner,
          favorite_characters = excluded.favorite_characters, favorite_quotes = excluded.favorite_quotes,
          app_theme = excluded.app_theme, atmosphere = excluded.atmosphere, updated_at = excluded.updated_at`)
        .bind(visitorKey, displayName, banner, JSON.stringify(favoriteCharacters), JSON.stringify(favoriteQuotes), appTheme, atmosphere, now, now).run();
      return Response.json({ ok: true, profile: { displayName, banner, favoriteCharacters, favoriteQuotes, appTheme, atmosphere } });
    }

    if (action === 'reaction') {
      const bookId = String(payload.bookId || '').trim();
      const chapterId = String(payload.chapterId || '').trim();
      const paragraphIndex = Math.max(0, Math.floor(Number(payload.paragraphIndex || 0)));
      const emoji = EMOTIONS.has(payload.emoji) ? payload.emoji : '';
      if (!bookId || !chapterId || !emoji) return Response.json({ error: 'Реакция не выбрана.' }, { status: 400 });
      const existing = await db.prepare(`SELECT id FROM paragraph_reactions WHERE visitor_key = ? AND chapter_id = ? AND paragraph_index = ? AND emoji = ? LIMIT 1`).bind(visitorKey, chapterId, paragraphIndex, emoji).first();
      if (existing) {
        await db.prepare(`DELETE FROM paragraph_reactions WHERE id = ?`).bind(existing.id).run();
      } else {
        await db.prepare(`INSERT INTO paragraph_reactions (id, visitor_key, book_id, chapter_id, paragraph_index, emoji, selected_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), visitorKey, bookId, chapterId, paragraphIndex, emoji, String(payload.selectedText || '').trim().slice(0, 12000), now).run();
      }
      const totals = await db.prepare(`SELECT emoji, COUNT(*) AS total FROM paragraph_reactions WHERE chapter_id = ? AND paragraph_index = ? GROUP BY emoji`).bind(chapterId, paragraphIndex).all();
      return Response.json({ ok: true, active: !existing, totals: totals.results || [] });
    }

    if (action === 'dictionary') {
      const id = String(payload.id || '').trim() || crypto.randomUUID();
      const bookId = String(payload.bookId || '').trim();
      const chapterId = String(payload.chapterId || '').trim();
      const word = String(payload.word || '').trim().slice(0, 240);
      const meaning = String(payload.meaning || '').trim().slice(0, 3000);
      if (!bookId || !chapterId || !word) return Response.json({ error: 'Выберите слово.' }, { status: 400 });
      await db.prepare(`INSERT INTO reader_dictionary (id, visitor_key, book_id, chapter_id, word, meaning, quote, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET meaning = excluded.meaning, quote = excluded.quote, updated_at = excluded.updated_at`)
        .bind(id, visitorKey, bookId, chapterId, word, meaning, String(payload.quote || '').trim().slice(0, 12000), now, now).run();
      return Response.json({ ok: true, id });
    }

    if (action === 'deleteDictionary') {
      await db.prepare(`DELETE FROM reader_dictionary WHERE id = ? AND visitor_key = ?`).bind(String(payload.id || ''), visitorKey).run();
      return Response.json({ ok: true });
    }

    if (action === 'emotion') {
      const bookId = String(payload.bookId || '').trim();
      const chapterId = String(payload.chapterId || '').trim();
      const emoji = EMOTIONS.has(payload.emoji) ? payload.emoji : '';
      if (!bookId || !chapterId || !emoji) return Response.json({ error: 'Выберите эмоцию.' }, { status: 400 });
      await db.prepare(`INSERT INTO chapter_emotions (visitor_key, book_id, chapter_id, emoji, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(visitor_key, chapter_id) DO UPDATE SET emoji = excluded.emoji, updated_at = excluded.updated_at`)
        .bind(visitorKey, bookId, chapterId, emoji, now, now).run();
      const totals = await db.prepare(`SELECT emoji, COUNT(*) AS total FROM chapter_emotions WHERE chapter_id = ? GROUP BY emoji`).bind(chapterId).all();
      return Response.json({ ok: true, totals: totals.results || [] });
    }

    if (action === 'capsule') {
      const bookId = String(payload.bookId || '').trim();
      if (!bookId) return Response.json({ error: 'Книга не указана.' }, { status: 400 });
      const firstImpression = String(payload.firstImpression || '').trim().slice(0, 5000);
      const finalImpression = String(payload.finalImpression || '').trim().slice(0, 5000);
      await db.prepare(`INSERT INTO reader_time_capsules (visitor_key, book_id, first_impression, final_impression, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(visitor_key, book_id) DO UPDATE SET first_impression = CASE WHEN excluded.first_impression != '' THEN excluded.first_impression ELSE reader_time_capsules.first_impression END,
        final_impression = CASE WHEN excluded.final_impression != '' THEN excluded.final_impression ELSE reader_time_capsules.final_impression END, updated_at = excluded.updated_at`)
        .bind(visitorKey, bookId, firstImpression, finalImpression, now, now).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Неизвестное действие.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить.' }, { status: 500 });
  }
}
