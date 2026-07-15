import '../../src/reader-access.css';

export const metadata = {
  title: 'Вход для читателей — BOOKNERD',
};

export default async function ReaderAccessPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === 'string' && params.next.startsWith('/')
    ? params.next
    : '/';
  const hasError = params?.error === '1';

  return (
    <main className="reader-access-page">
      <section className="reader-access-card" aria-labelledby="reader-access-title">
        <a className="reader-access-brand" href="/" aria-label="BOOKNERD">
          BOOK<span>NERD</span>
        </a>
        <p className="reader-access-kicker">Закрытый книжный клуб</p>
        <h1 id="reader-access-title">Добро пожаловать к нашим историям</h1>
        <p className="reader-access-copy">
          Введите пароль читателя, который вы получили от команды BOOKNERD.
        </p>

        <form className="reader-access-form" action="/api/reader-access" method="post">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="reader-password">Пароль</label>
          <input
            id="reader-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Введите пароль"
            required
            autoFocus
          />
          {hasError ? <p className="reader-access-error">Пароль не подошёл. Попробуйте ещё раз.</p> : null}
          <button type="submit">Войти в BOOKNERD</button>
        </form>

        <p className="reader-access-note">Нет пароля? Обратитесь к команде BOOKNERD.</p>
      </section>
    </main>
  );
}
