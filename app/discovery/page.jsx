import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import DiscoveryDashboard from '../../src/discovery-dashboard.jsx';
import { SiteHeader } from '../../src/page-chrome.jsx';
export const dynamic = 'force-dynamic';
export default async function Page() {
  await requireReaderAccess('/discovery');
  return <main className="site-shell shelf-page"><SiteHeader compact /><DiscoveryDashboard books={await listPublicBooks()} /></main>;
}
