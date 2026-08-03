import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import LibraryPage from '../../src/library-page.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Моя библиотека — BOOKNERD' };

export default async function Page() {
  await requireReaderAccess('/library');
  const books = await listPublicBooks();
  return <LibraryPage initialBooks={books} />;
}
