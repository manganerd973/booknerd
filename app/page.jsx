import BooknerdSite from '../src/main.jsx';
import { listPublicBooks } from '../lib/books.js';
import { listPopularComments } from '../lib/comments.js';
import { requireReaderAccess } from '../lib/reader-access.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireReaderAccess('/');
  let books = [];
  let popularComments = [];
  try {
    [books, popularComments] = await Promise.all([listPublicBooks(), listPopularComments(6)]);
  } catch {
    try { books = await listPublicBooks(); } catch { books = []; }
  }
  return <BooknerdSite initialBooks={books} initialPopularComments={popularComments} />;
}
