import { requireReaderAccess } from '../../lib/reader-access.js';
import ReadingLeaders from '../../src/reading-leaders.jsx';
import { SiteHeader, ShelfNavigation } from '../../src/page-chrome.jsx';
export const dynamic = 'force-dynamic';
export default async function Page() {
  await requireReaderAccess('/reading-leaders');
  return <main className="site-shell shelf-page"><SiteHeader compact /><ReadingLeaders full /><ShelfNavigation /></main>;
}
