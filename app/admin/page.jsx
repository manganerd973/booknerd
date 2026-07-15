import { requireChatGPTUser, signOutPath } from '../chatgpt-auth.js';
import { getAdminRole } from '../../lib/admin-auth.js';
import AdminDashboard from '../../src/admin.jsx';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireChatGPTUser('/admin');
  const role = await getAdminRole(user.email);

  if (!role) {
    return (
      <main className="admin-access-page">
        <div className="admin-access-card">
          <span className="admin-kicker">BOOKNERD · ПАНЕЛЬ КОМАНДЫ</span>
          <h1>Доступ пока не открыт</h1>
          <p>Попросите создателя BOOKNERD добавить email этого аккаунта в команду.</p>
          <div className="admin-access-actions">
            <a href="/">Вернуться на сайт</a>
            <a href={signOutPath('/admin')}>Войти в другой аккаунт</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <AdminDashboard
      currentUser={{ displayName: user.displayName, email: user.email, role }}
      signOutHref={signOutPath('/')}
    />
  );
}
