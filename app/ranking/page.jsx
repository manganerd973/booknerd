import { requireReaderAccess } from '../../lib/reader-access.js';
import RankingsPage from '../../src/rankings-page.jsx';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireReaderAccess('/ranking');
  return <RankingsPage />;
}
