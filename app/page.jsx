import BooknerdSite from '../src/main.jsx';
import { listPublicBooks } from '../lib/books.js';
import { listPopularComments } from '../lib/comments.js';
import { getQuoteOfDay } from '../lib/reader-notes.js';
import { requireReaderAccess } from '../lib/reader-access.js';
import { listFeaturedArtworks } from '../lib/artworks.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireReaderAccess('/');
  let books = [];
  let popularComments = [];
  let quoteOfDay = null;
  let featuredArtworks = [];
  try {
    [books, popularComments, quoteOfDay, featuredArtworks] = await Promise.all([listPublicBooks(), listPopularComments(6), getQuoteOfDay(), listFeaturedArtworks(12)]);
  } catch {
    try { books = await listPublicBooks(); } catch { books = []; }
    try { quoteOfDay = await getQuoteOfDay(); } catch { quoteOfDay = null; }
    try { featuredArtworks = await listFeaturedArtworks(12); } catch { featuredArtworks = []; }
  }
  return <BooknerdSite initialBooks={books} initialPopularComments={popularComments} initialQuoteOfDay={quoteOfDay} initialFeaturedArtworks={featuredArtworks} />;
}
