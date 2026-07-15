import { requireAdminSession } from '../../lib/admin-auth.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import AdminDashboard from '../../src/admin.jsx';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireReaderAccess('/admin');
  const user = await requireAdminSession('/admin');

  return (
    <AdminDashboard
      currentUser={user}
      signOutHref="/api/admin/logout"
    />
  );
}
