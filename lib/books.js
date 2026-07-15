import { getDb, requireDb } from './runtime.js';

function parseGenres(value) {
  try {
    const genres = JSON.parse(value || '[]');
    return Array.isArray(genres) ? genres.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function mapBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    originalTitle: row.original_title || '',
    author: row.author,
    synopsis: row.synopsis || '',
    genres: parseGenres(row.genres),
    genre: parseGenres(row.genres)[0] || 'Другое',
    status: row.status,
    progress: Number(row.progress || 0),
    coverKey: row.cover_key || null,
    coverUrl: row.cover_key ? `/api/covers/${row.cover_key.split('/').map(encodeURIComponent).join('/')}` : null,
    published: Boolean(row.published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChapter(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    chapterNumber: Number(row.chapter_number),
    title: row.title,
    body: row.body || '',
    status: row.status,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPublicBooks() {
  const db = getDb();
  if (!db) return [];
  const result = await db.prepare(
    `SELECT * FROM books WHERE published = 1 ORDER BY updated_at DESC`
  ).all();
  return (result.results || []).map(mapBook);
}

export async function listAllBooks() {
  const db = requireDb();
  const result = await db.prepare(
    `SELECT b.*, COUNT(c.id) AS chapter_count,
      SUM(CASE WHEN c.status = 'published' THEN 1 ELSE 0 END) AS published_chapter_count
     FROM books b
     LEFT JOIN chapters c ON c.book_id = b.id
     GROUP BY b.id
     ORDER BY b.updated_at DESC`
  ).all();
  return (result.results || []).map((row) => ({
    ...mapBook(row),
    chapterCount: Number(row.chapter_count || 0),
    publishedChapterCount: Number(row.published_chapter_count || 0),
  }));
}

export async function getBookBySlug(slug, includeDraft = false) {
  const db = getDb();
  if (!db) return null;
  const row = await db.prepare(
    `SELECT * FROM books WHERE slug = ? ${includeDraft ? '' : 'AND published = 1'} LIMIT 1`
  ).bind(slug).first();
  return mapBook(row);
}

export async function getBookById(id) {
  const db = requireDb();
  const row = await db.prepare(`SELECT * FROM books WHERE id = ? LIMIT 1`).bind(id).first();
  return mapBook(row);
}

export async function listChapters(bookId, includeDraft = false) {
  const db = getDb();
  if (!db) return [];
  const result = await db.prepare(
    `SELECT * FROM chapters WHERE book_id = ? ${includeDraft ? '' : "AND status = 'published'"}
     ORDER BY chapter_number ASC`
  ).bind(bookId).all();
  return (result.results || []).map(mapChapter);
}

export async function getChapter(id, includeDraft = false) {
  const db = getDb();
  if (!db) return null;
  const row = await db.prepare(
    `SELECT * FROM chapters WHERE id = ? ${includeDraft ? '' : "AND status = 'published'"} LIMIT 1`
  ).bind(id).first();
  return mapChapter(row);
}

const cyrillicMap = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ь: '', ъ: '',
};

export function slugify(value) {
  const transliterated = String(value || '').toLowerCase().split('').map((letter) => cyrillicMap[letter] ?? letter).join('');
  const slug = transliterated.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return slug || `book-${crypto.randomUUID().slice(0, 8)}`;
}
