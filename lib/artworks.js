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
  };
}

export async function listBookArtworks(bookId) {
  if (!getDb()) return [];
  const result = await (await ensureDb()).prepare(
    `SELECT * FROM book_artworks WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(bookId).all();
  return (result.results || []).map(mapArtwork);
}
