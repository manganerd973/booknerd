import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import ProfilePage from '../../src/profile-page.jsx';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireReaderAccess('/profile');
  return <ProfilePage books={await listPublicBooks()} />;
}
