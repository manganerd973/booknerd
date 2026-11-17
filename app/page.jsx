import BooknerdSite from '../src/main.jsx';
import { listPublicBooks, listRecentPublicChapters } from '../lib/books.js';
import { getQuoteOfDay } from '../lib/reader-notes.js';
import { requireReaderAccess } from '../lib/reader-access.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireReaderAccess('/');
  const [books, quoteOfDay, chapters] = await Promise.all([
    listPublicBooks().catch(() => []),
    getQuoteOfDay().catch(() => null),
    listRecentPublicChapters().catch(() => []),
  ]);
  return <BooknerdSite initialBooks={books} initialChapters={chapters} initialQuoteOfDay={quoteOfDay} />;
}
