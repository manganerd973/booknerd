import BooknerdSite from '../src/main.jsx';
import { listPublicBooks } from '../lib/books.js';
import { listPopularComments } from '../lib/comments.js';
import { getQuoteOfDay } from '../lib/reader-notes.js';
import { requireReaderAccess } from '../lib/reader-access.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireReaderAccess('/');
  let books = [];
  let popularComments = [];
  let quoteOfDay = null;
  try {
    [books, popularComments, quoteOfDay] = await Promise.all([listPublicBooks(), listPopularComments(6), getQuoteOfDay()]);
  } catch {
    try { books = await listPublicBooks(); } catch { books = []; }
    try { quoteOfDay = await getQuoteOfDay(); } catch { quoteOfDay = null; }
  }
  return <BooknerdSite initialBooks={books} initialPopularComments={popularComments} initialQuoteOfDay={quoteOfDay} />;
}
