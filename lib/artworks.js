import { ensureDb, getDb } from './runtime.js';

export function artworkImageUrl(imageKey) {
  return imageKey ? `/api/covers/${imageKey.split('/').map(encodeURIComponent).join('/')}` : null;
}

export function mapArtwork(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    imageKey: row.image_key,
    imageUrl: artworkImageUrl(row.image_key),
    caption: row.caption || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    bookSlug: row.book_slug || '',
    bookTitle: row.book_title || '',
    bookAuthor: row.book_author || '',
  };
}

export async function listBookArtworks(bookId) {
  if (!getDb()) return [];
  const result = await (await ensureDb()).prepare(
    `SELECT * FROM book_artworks WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(bookId).all();
  return (result.results || []).map(mapArtwork);
}

export async function listFeaturedArtworks(limit = 8) {
  if (!getDb()) return [];
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 8));
  const result = await (await ensureDb()).prepare(
    `SELECT ba.*, b.slug AS book_slug, b.title AS book_title, b.author AS book_author
     FROM book_artworks ba
     INNER JOIN books b ON b.id = ba.book_id
     WHERE b.published = 1
     ORDER BY ba.created_at DESC, ba.sort_order ASC
     LIMIT ?`
  ).bind(safeLimit * 4).all();
  const artworks = (result.results || []).map(mapArtwork);
  const selected = [];
  const selectedIds = new Set();
  const seenBooks = new Set();
  for (const artwork of artworks) {
    if (seenBooks.has(artwork.bookId)) continue;
    selected.push(artwork);
    selectedIds.add(artwork.id);
    seenBooks.add(artwork.bookId);
    if (selected.length >= safeLimit) return selected;
  }
  for (const artwork of artworks) {
    if (selectedIds.has(artwork.id)) continue;
    selected.push(artwork);
    if (selected.length >= safeLimit) break;
  }
  return selected;
}
