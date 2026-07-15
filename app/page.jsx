import BooknerdSite from '../src/main.jsx';
import { listPublicBooks } from '../lib/books.js';
import { requireReaderAccess } from '../lib/reader-access.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireReaderAccess('/');
  let books = [];
  try { books = await listPublicBooks(); } catch { books = []; }
  return <BooknerdSite initialBooks={books} />;
}
