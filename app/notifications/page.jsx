import { requireReaderAccess } from '../../lib/reader-access.js';
import NotificationsPage from '../../src/notifications-page.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Уведомления — BOOKNERD' };

export default async function Page() {
  await requireReaderAccess('/notifications');
  return <NotificationsPage />;
}
