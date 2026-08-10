import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import CommunityPage from '../../src/community-page.jsx';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireReaderAccess('/community');
  return <CommunityPage books={await listPublicBooks()} />;
}
