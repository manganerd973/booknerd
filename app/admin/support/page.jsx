import AdminThemeToggle from '../../../src/admin-theme-toggle.jsx';
import PurpleCat from '../../../src/purple-cat.jsx';
import { notFound } from 'next/navigation';
import { requireAdminSession } from '../../../lib/admin-auth.js';
import { requireReaderAccess } from '../../../lib/reader-access.js';
import { getSupportCard } from '../../../lib/support.js';

export const dynamic = 'force-dynamic';

export default async function SupportSettings({ searchParams }) {
  await requireReaderAccess('/admin/support');
  const user = await requireAdminSession('/admin/support');
  if (user.role !== 'owner') notFound();
  const [card, params] = await Promise.all([getSupportCard(), searchParams]);
  const message = { saved: 'Настройки сохранены.', invalid: 'Проверьте номер карты. Нужно от 12 до 19 цифр.', failed: 'Не удалось сохранить настройки.' }[params?.result];
  return (
    <main className="admin-support-page">
      <AdminThemeToggle />
      <a href="/admin">← Редакционная</a>
      <h1>Благодарность читателей</h1>
      <section className="admin-support-preview"><div className="reader-support-message"><p>Мур! Если хотите порадовать нас шоколадкой, то вот наши реквизиты</p><PurpleCat /></div><h2>Шоколадка для команды BOOKNERD</h2><p>Такой блок появится после главы, когда вы сохраните номер карты.</p></section>
      <form className="admin-support-form" method="post" action="/api/admin/support">
        <label>Номер карты для переводов
          <input className="shelf-control" name="card" inputMode="numeric" autoComplete="off" maxLength={30} defaultValue={card} />
        </label>
        <p>Номер увидят читатели в конце главы. Очистите поле и сохраните, чтобы убрать карту.</p>
        <button className="shelf-control" type="submit">Сохранить</button>
        {message && <p role="status">{message}</p>}
      </form>
    </main>
  );
}
