import BooknerdSite from '../src/main.jsx';
import { listPublicBooks } from '../lib/books.js';
import { listPopularComments } from '../lib/comments.js';
import { requireReaderAccess } from '../lib/reader-access.js';
import { listFeaturedArtworks } from '../lib/artworks.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireReaderAccess('/');
  const [booksResult, commentsResult, artworksResult] = await Promise.allSettled([
    listPublicBooks(),
    listPopularComments(6),
    listFeaturedArtworks(12),
  ]);
  return (
    <BooknerdSite
      initialBooks={booksResult.status === 'fulfilled' ? booksResult.value : []}
      initialPopularComments={commentsResult.status === 'fulfilled' ? commentsResult.value : []}
      initialQuoteOfDay={null}
      initialFeaturedArtworks={artworksResult.status === 'fulfilled' ? artworksResult.value : []}
    />
  );
}
