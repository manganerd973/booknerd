import { notFound } from 'next/navigation';
import { getBookBySlug, listChapters, listSeriesBooks } from '../../../lib/books.js';
import { listBookArtworks } from '../../../lib/artworks.js';
import { requireReaderAccess } from '../../../lib/reader-access.js';
import BookDetailPage from '../../../src/book-detail-page.jsx';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params }) {
  const { slug } = await params;
  await requireReaderAccess(`/books/${slug}`);
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const [chapters, artworks, seriesBooks] = await Promise.all([
    listChapters(book.id),
    listBookArtworks(book.id),
    listSeriesBooks(book.seriesTitle),
  ]);
  return <BookDetailPage book={book} chapters={chapters} artworks={artworks} seriesBooks={seriesBooks} />;
}
