import { requireReaderAccess } from '../../lib/reader-access.js';
import { ReaderStatistics } from '../../src/home-reader-features.jsx';
import { SiteHeader, ShelfNavigation } from '../../src/page-chrome.jsx';
export const dynamic = 'force-dynamic';
export default async function Page() {
  await requireReaderAccess('/reading-stats');
  return <main className="site-shell shelf-page"><SiteHeader compact /><ReaderStatistics /><ShelfNavigation /></main>;
}
