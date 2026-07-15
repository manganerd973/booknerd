import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import TranslationsPage from '../../src/translations-page.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Переводы — BOOKNERD' };

export default async function Page() {
  await requireReaderAccess('/translations');
  const books = await listPublicBooks();
  return <TranslationsPage initialBooks={books} />;
}
