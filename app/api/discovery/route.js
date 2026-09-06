import { hasReaderAccess } from '../../../lib/reader-access.js';
import { cachedRead } from '../../../lib/read-cache.js';
import { ensureDb } from '../../../lib/runtime.js';

const DISCOVERY_CACHE_MS = 60 * 60 * 1000;
const CACHE_VERSION = 'v43';

async function requireReader(request) {
  if (await hasReaderAccess(request)) return null;
  return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
}

function mapMiniBook(row) {
  return row ? {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    country: row.country || '',
    pageCount: Number(row.page_count || 0),
    status: row.status,
    coverUrl: row.cover_key ? `/api/covers/${String(row.cover_key).split('/').map(encodeURIComponent).join('/')}` : null,
    score: Number(row.score || 0),
  } : null;
}

function cacheKey(request, slot) {
  const url = new URL(request.url);
  url.pathname = '/__booknerd-cache/discovery';
  url.search = `version=${CACHE_VERSION}&slot=${slot}`;
  return new Request(url.toString(), { method: 'GET' });
}

function clientResponse(payload, status) {
  return Response.json(payload, {
    headers: {
      'cache-control': 'private, no-store, max-age=0',
      'x-booknerd-cache': status,
    },
  });
}

async function loadDiscoveryData() {
  const db = await ensureDb();
  const now = new Date();
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(dayStart.getTime() + 86400000);
  const yesterday = new Date(dayStart.getTime() - 86400000);
  const weekAgo = new Date(dayStart.getTime() - 7 * 86400000);
  const monthDay = now.toISOString().slice(5, 10);
  const [today, discussed, trending, teamPick, birthday, anniversary, commentsWeek, lengths] = await Promise.all([
    db.prepare(`SELECT c.id AS chapter_id, c.title AS chapter_title, c.chapter_number, c.published_at, b.id, b.slug, b.title, b.author, b.country, b.page_count, b.status, b.cover_key
      FROM chapters c JOIN books b ON b.id = c.book_id WHERE c.status = 'published' AND c.published_at >= ? AND c.published_at < ? ORDER BY c.published_at DESC LIMIT 12`)
      .bind(dayStart.toISOString(), tomorrow.toISOString()).all(),
    db.prepare(`SELECT b.*, COUNT(c.id) AS score FROM books b JOIN comments c ON c.book_id = b.id WHERE b.published = 1 AND c.status = 'approved' AND c.created_at >= ? GROUP BY b.id ORDER BY score DESC LIMIT 8`).bind(yesterday.toISOString()).all(),
    db.prepare(`SELECT *, 0 AS score FROM books WHERE published = 1 ORDER BY updated_at DESC LIMIT 8`).all(),
    db.prepare(`SELECT *, 1 AS score FROM books WHERE published = 1 AND team_pick = 1 ORDER BY updated_at DESC LIMIT 8`).all(),
    db.prepare(`SELECT *, 1 AS score FROM books WHERE published = 1 AND substr(author_birthday, 6, 5) = ? ORDER BY author LIMIT 8`).bind(monthDay).all(),
    db.prepare(`SELECT *, 1 AS score FROM books WHERE published = 1 AND substr(original_release_date, 6, 5) = ? ORDER BY original_release_date LIMIT 8`).bind(monthDay).all(),
    db.prepare(`SELECT c.id, c.author_name, c.body, c.is_spoiler, c.created_at, b.title AS book_title, b.slug AS book_slug,
      SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END) - SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END) AS score
      FROM comments c JOIN books b ON b.id = c.book_id LEFT JOIN comment_votes v ON v.comment_id = c.id
      WHERE c.status = 'approved' AND c.created_at >= ? GROUP BY c.id ORDER BY score DESC, c.created_at DESC LIMIT 8`).bind(weekAgo.toISOString()).all(),
    db.prepare(`SELECT * FROM books WHERE published = 1 AND page_count > 0 ORDER BY page_count DESC`).all(),
  ]);
  const lengthRows = lengths.results || [];
  return {
    today: (today.results || []).map((row) => ({ ...mapMiniBook(row), chapterId: row.chapter_id, chapterTitle: row.chapter_title, chapterNumber: Number(row.chapter_number || 0) })),
    discussed: (discussed.results || []).map(mapMiniBook),
    trending: (trending.results || []).map(mapMiniBook),
    teamPick: (teamPick.results || []).map(mapMiniBook),
    birthdays: (birthday.results || []).map(mapMiniBook),
    anniversaries: (anniversary.results || []).map(mapMiniBook),
    commentsWeek: commentsWeek.results || [],
    records: {
      longest: mapMiniBook(lengthRows[0]),
      shortest: mapMiniBook(lengthRows[lengthRows.length - 1]),
      emotional: null,
      reread: null,
      saved: null,
      fast: null,
      activeHours: [],
    },
  };
}

export async function GET(request) {
  const denied = await requireReader(request);
  if (denied) return denied;
  try {
    const slot = Math.floor(Date.now() / DISCOVERY_CACHE_MS);
    const edgeCache = globalThis.caches?.default || null;
    const key = cacheKey(request, slot);
    if (edgeCache) {
      const cached = await edgeCache.match(key).catch(() => null);
      if (cached) {
        const payload = await cached.json().catch(() => null);
        if (payload?.records) return clientResponse(payload, 'HIT');
      }
    }

    const payload = await cachedRead(`discovery:${CACHE_VERSION}:${slot}`, DISCOVERY_CACHE_MS, loadDiscoveryData);
    if (edgeCache) {
      const nextSlot = (slot + 1) * DISCOVERY_CACHE_MS;
      const seconds = Math.max(1, Math.ceil((nextSlot - Date.now()) / 1000));
      await edgeCache.put(key, Response.json(payload, { headers: { 'cache-control': `public, max-age=${seconds}` } })).catch(() => {});
    }
    return clientResponse(payload, 'MISS');
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть рекомендации.' }, { status: 503 });
  }
}
