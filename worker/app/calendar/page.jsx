import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import CalendarPage from '../../src/calendar-page.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Календарь глав — BOOKNERD' };

export default async function Page() {
  await requireReaderAccess('/calendar');
  const books = await listPublicBooks();
  return <CalendarPage books={books} />;
}
