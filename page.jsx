import BooknerdSite from '../src/main.jsx';
import { listPublicBooks } from '../lib/books.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let books = [];
  try { books = await listPublicBooks(); } catch { books = []; }
  return <BooknerdSite initialBooks={books} />;
}
