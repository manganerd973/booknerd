import { requireReaderAccess } from '../../../lib/reader-access.js';

export const metadata = {
  title: 'Вход в редакционную — BOOKNERD',
};

export default async function AdminLoginPage({ searchParams }) {
  await requireReaderAccess('/admin/login');
  const params = await searchParams;
  const next = typeof params?.next === 'string' && params.next.startsWith('/') ? params.next : '/admin';
  const error = params?.error;

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <a className="admin-login-brand" href="/"><span>B</span><strong>BOOKNERD.</strong></a>
        <span className="admin-kicker">ЗАКРЫТАЯ РЕДАКЦИОННАЯ</span>
        <h1>Управление<br /><em>библиотекой.</em></h1>
        <p>Владелица входит по своему отдельному паролю. Участники команды указывают email и командный пароль.</p>

        <form action="/api/admin/login" method="post" className="admin-login-form">
          <input type="hidden" name="next" value={next} />
          <label>
            <span>Email — только для участника команды</span>
            <input type="email" name="email" placeholder="name@example.com" autoComplete="email" />
          </label>
          <label>
            <span>Пароль редакционной</span>
            <input type="password" name="password" placeholder="Введите пароль" autoComplete="current-password" required autoFocus />
          </label>
          {error === 'setup' ? <p className="admin-login-error">Сначала добавьте пароль владелицы в Cloudflare.</p> : null}
          {error === '1' ? <p className="admin-login-error">Пароль или email не подошли.</p> : null}
          <button type="submit">Войти в панель</button>
        </form>

        <a className="admin-login-back" href="/">← Вернуться на сайт</a>
      </section>
      <aside className="admin-login-aside" aria-hidden="true">
        <span>ADD</span><span>EDIT</span><span>PUBLISH</span><span>READ</span>
        <div><strong>Все истории</strong><small>под вашим контролем</small></div>
      </aside>
    </main>
  );
}
