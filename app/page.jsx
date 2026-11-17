import BooknerdSite from '../src/main.jsx';
import { listPublicBooks, listRecentPublicChapters } from '../lib/books.js';
import { listPopularComments } from '../lib/comments.js';
import { getQuoteOfDay } from '../lib/reader-notes.js';
import { requireReaderAccess } from '../lib/reader-access.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireReaderAccess('/');
  const [books, popularComments, quoteOfDay, chapters] = await Promise.all([
    listPublicBooks().catch(() => []),
    listPopularComments(6).catch(() => []),
    getQuoteOfDay().catch(() => null),
    listRecentPublicChapters().catch(() => []),
  ]);
  return <BooknerdSite initialBooks={books} initialChapters={chapters} initialPopularComments={popularComments} initialQuoteOfDay={quoteOfDay} />;
}
