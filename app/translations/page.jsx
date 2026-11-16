import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import TranslationsPage from '../../src/translations-page.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Переводы — BOOKNERD' };

export default async function Page({ searchParams }) {
  await requireReaderAccess('/translations');
  const books = await listPublicBooks();
  const options = await searchParams;
  const view = ['new', 'finished', 'rated', 'recommended', 'collections'].includes(options?.view) ? options.view : 'all';
  const collection = typeof options?.collection === 'string' ? options.collection : '';
  return <TranslationsPage initialBooks={books} initialView={view} collectionKey={collection} />;
}
