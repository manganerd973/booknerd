'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';

const blankBook = {
  id: null,
  slug: '',
  title: '',
  originalTitle: '',
  author: '',
  synopsis: '',
  genres: [],
  status: 'Черновик',
  progress: 0,
  coverKey: null,
  coverUrl: null,
  published: false,
};

const blankChapter = {
  id: null,
  chapterNumber: 1,
  title: '',
  body: '',
  status: 'draft',
};

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}

function Brand() {
  return (
    <a className="admin-brand" href="/">
      <span>B</span>
      <strong>BOOKNERD.</strong>
    </a>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`admin-notice ${notice.type === 'error' ? 'is-error' : ''}`} role="status">
      {notice.type === 'success' ? <Check size={18} /> : <span>!</span>}
      <p>{notice.message}</p>
      <button onClick={onClose} aria-label="Закрыть уведомление"><X size={17} /></button>
    </div>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <div className="admin-empty">
      <BookOpen size={42} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export default function AdminDashboard({ currentUser, signOutHref }) {
  const [view, setView] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [bookForm, setBookForm] = useState(blankBook);
  const [chapters, setChapters] = useState([]);
  const [chapterForm, setChapterForm] = useState(blankChapter);
  const [team, setTeam] = useState([]);
  const [teamEmail, setTeamEmail] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);

  const flash = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/api/admin/books');
      setBooks(data.books || []);
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return books;
    return books.filter((book) => `${book.title} ${book.author} ${book.status}`.toLowerCase().includes(normalized));
  }, [books, query]);

  const stats = useMemo(() => ({
    all: books.length,
    published: books.filter((book) => book.published).length,
    chapters: books.reduce((sum, book) => sum + Number(book.chapterCount || 0), 0),
    drafts: books.filter((book) => !book.published).length,
  }), [books]);

  const navigate = (next) => {
    setView(next);
    setMenuOpen(false);
    if (next === 'team') loadTeam();
  };

  const startNewBook = () => {
    setBookForm({ ...blankBook });
    setChapters([]);
    setChapterForm({ ...blankChapter });
    navigate('book');
  };

  const openBook = async (book) => {
    setBookForm({ ...blankBook, ...book });
    setChapterForm({ ...blankChapter });
    navigate('book');
    try {
      const data = await api(`/api/admin/books/${book.id}/chapters`);
      setChapters(data.chapters || []);
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const saveBook = async (event) => {
    event.preventDefault();
    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      flash('Укажите название книги и автора.', 'error');
      return;
    }
    setSaving(true);
    try {
      const editing = Boolean(bookForm.id);
      const data = await api(editing ? `/api/admin/books/${bookForm.id}` : '/api/admin/books', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bookForm),
      });
      const id = bookForm.id || data.id;
      setBookForm((current) => ({ ...current, id, slug: data.slug }));
      flash(editing ? 'Книга сохранена.' : 'Книга добавлена. Теперь можно создать главы.');
      await loadBooks();
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const data = await api('/api/admin/covers', { method: 'POST', body: formData });
      setBookForm((current) => ({ ...current, coverKey: data.key, coverUrl: data.coverUrl }));
      flash('Обложка загружена. Сохраните книгу.');
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const deleteBook = async () => {
    if (!bookForm.id || !window.confirm(`Удалить «${bookForm.title}» вместе со всеми главами?`)) return;
    try {
      await api(`/api/admin/books/${bookForm.id}`, { method: 'DELETE' });
      flash('Книга удалена.');
      await loadBooks();
      navigate('dashboard');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const startNewChapter = () => {
    setChapterForm({ ...blankChapter, chapterNumber: chapters.length + 1 });
  };

  const saveChapter = async (event) => {
    event.preventDefault();
    if (!bookForm.id) {
      flash('Сначала сохраните книгу.', 'error');
      return;
    }
    if (!chapterForm.title.trim()) {
      flash('Укажите название главы.', 'error');
      return;
    }
    setSaving(true);
    try {
      const editing = Boolean(chapterForm.id);
      const data = await api(
        editing ? `/api/admin/chapters/${chapterForm.id}` : `/api/admin/books/${bookForm.id}/chapters`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(chapterForm),
        },
      );
      flash(chapterForm.status === 'published' ? 'Глава опубликована.' : 'Глава сохранена в черновиках.');
      const refreshed = await api(`/api/admin/books/${bookForm.id}/chapters`);
      setChapters(refreshed.chapters || []);
      const updated = (refreshed.chapters || []).find((chapter) => chapter.id === (chapterForm.id || data.id));
      setChapterForm(updated || { ...blankChapter });
      await loadBooks();
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteChapter = async () => {
    if (!chapterForm.id || !window.confirm('Удалить эту главу?')) return;
    try {
      await api(`/api/admin/chapters/${chapterForm.id}`, { method: 'DELETE' });
      setChapters((current) => current.filter((chapter) => chapter.id !== chapterForm.id));
      setChapterForm({ ...blankChapter, chapterNumber: Math.max(1, chapters.length) });
      flash('Глава удалена.');
      await loadBooks();
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  async function loadTeam() {
    if (currentUser.role !== 'owner') return;
    try {
      const data = await api('/api/admin/team');
      setTeam(data.team || []);
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  const addTeamMember = async (event) => {
    event.preventDefault();
    if (!teamEmail.trim()) return;
    try {
      await api('/api/admin/team', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: teamEmail }),
      });
      setTeamEmail('');
      await loadTeam();
      flash('Участник добавлен. Теперь он сможет войти в панель.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const removeTeamMember = async (email) => {
    if (!window.confirm(`Закрыть доступ для ${email}?`)) return;
    try {
      await api('/api/admin/team', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      await loadTeam();
      flash('Доступ участника закрыт.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  return (
    <div className="admin-shell">
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-sidebar-head">
          <Brand />
          <button className="admin-close-menu" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <div className="admin-workspace-label">Редакционная</div>
        <nav className="admin-nav" aria-label="Панель управления">
          <button className={view === 'dashboard' ? 'is-active' : ''} onClick={() => navigate('dashboard')}>
            <LayoutDashboard size={19} /> Обзор
          </button>
          <button className={view === 'books' ? 'is-active' : ''} onClick={() => navigate('books')}>
            <BookOpen size={19} /> Все книги <span>{books.length}</span>
          </button>
          <button className={view === 'book' && !bookForm.id ? 'is-active' : ''} onClick={startNewBook}>
            <Plus size={19} /> Добавить книгу
          </button>
          {currentUser.role === 'owner' && (
            <button className={view === 'team' ? 'is-active' : ''} onClick={() => navigate('team')}>
              <Users size={19} /> Команда
            </button>
          )}
        </nav>
        <div className="admin-sidebar-note">
          <span>✦</span>
          <p>Каждая глава проходит перевод, редактуру и корректуру.</p>
        </div>
        <div className="admin-user">
          <div className="admin-avatar">{currentUser.displayName.slice(0, 1).toUpperCase()}</div>
          <div><strong>{currentUser.role === 'owner' ? 'Создатель' : 'Участник команды'}</strong><span>{currentUser.email}</span></div>
          <a href={signOutHref} aria-label="Выйти"><LogOut size={18} /></a>
        </div>
      </aside>

      {menuOpen && <button className="admin-menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-toggle" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div>
            <span>BOOKNERD · ПАНЕЛЬ КОМАНДЫ</span>
            <strong>{view === 'book' ? (bookForm.id ? 'Редактирование книги' : 'Новая книга') : view === 'team' ? 'Доступ команды' : 'Управление библиотекой'}</strong>
          </div>
          <a href="/" target="_blank">Открыть сайт <ChevronRight size={17} /></a>
        </header>

        {(view === 'dashboard' || view === 'books') && (
          <section className="admin-content">
            <div className="admin-hero-row">
              <div>
                <span className="admin-kicker">ИСТОРИИ ПОД ВАШИМ КОНТРОЛЕМ</span>
                <h1>{view === 'dashboard' ? <>Добро пожаловать<br />в <em>редакционную.</em></> : <>Все книги<br /><em>BOOKNERD.</em></>}</h1>
                <p>Добавляйте переводы, готовьте главы и решайте, когда история появится у читателей.</p>
              </div>
              <button className="admin-primary" onClick={startNewBook}><Plus size={19} /> Добавить книгу</button>
            </div>

            <div className="admin-stats">
              <article><span>01</span><strong>{stats.all}</strong><p>книг в библиотеке</p></article>
              <article><span>02</span><strong>{stats.published}</strong><p>опубликовано</p></article>
              <article><span>03</span><strong>{stats.chapters}</strong><p>глав добавлено</p></article>
              <article><span>04</span><strong>{stats.drafts}</strong><p>черновиков</p></article>
            </div>

            <div className="admin-list-head">
              <div><span>{view === 'dashboard' ? 'ПОСЛЕДНИЕ КНИГИ' : 'КАТАЛОГ'}</span><h2>{view === 'dashboard' ? 'Продолжить работу' : 'Управление книгами'}</h2></div>
              <label className="admin-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти книгу" /></label>
            </div>

            {loading ? (
              <div className="admin-loading"><LoaderCircle className="spin" /> Загружаем библиотеку…</div>
            ) : filteredBooks.length ? (
              <div className="admin-book-grid">
                {filteredBooks.slice(0, view === 'dashboard' ? 6 : undefined).map((book) => (
                  <button className="admin-book-card" key={book.id} onClick={() => openBook(book)}>
                    <div className="admin-book-cover">
                      {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <><span>перевод booknerd</span><strong>{book.title}</strong><small>{book.author}</small></>}
                      <b className={book.published ? 'is-live' : ''}>{book.published ? 'На сайте' : 'Черновик'}</b>
                    </div>
                    <div className="admin-book-card-copy">
                      <span>{book.status} · {book.progress}%</span>
                      <h3>{book.title}</h3>
                      <p>{book.author}</p>
                      <div><FileText size={15} /> {book.chapterCount || 0} глав <ChevronRight size={18} /></div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="Библиотека пока пуста" text="Добавьте первую настоящую книгу BOOKNERD." action={<button className="admin-primary" onClick={startNewBook}><Plus size={18} /> Добавить книгу</button>} />
            )}
          </section>
        )}

        {view === 'book' && (
          <section className="admin-content admin-editor-page">
            <button className="admin-back" onClick={() => navigate('books')}><ArrowLeft size={18} /> Ко всем книгам</button>
            <div className="admin-editor-heading">
              <div><span className="admin-kicker">{bookForm.id ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ИСТОРИЯ'}</span><h1>{bookForm.title || 'Новая книга'}</h1></div>
              {bookForm.id && currentUser.role === 'owner' && <button className="admin-danger" onClick={deleteBook}><Trash2 size={17} /> Удалить книгу</button>}
            </div>

            <form className="admin-book-form" onSubmit={saveBook}>
              <div className="admin-form-main">
                <section className="admin-form-card">
                  <div className="admin-card-title"><span>01</span><div><h2>Основная информация</h2><p>То, что увидят читатели на странице книги.</p></div></div>
                  <div className="admin-fields two-columns">
                    <label><span>Название книги *</span><input value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} placeholder="Например, Плетёное королевство" /></label>
                    <label><span>Автор *</span><input value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} placeholder="Имя автора" /></label>
                    <label><span>Оригинальное название</span><input value={bookForm.originalTitle} onChange={(event) => setBookForm({ ...bookForm, originalTitle: event.target.value })} placeholder="Название на языке оригинала" /></label>
                    <label><span>Адрес страницы</span><input value={bookForm.slug} onChange={(event) => setBookForm({ ...bookForm, slug: event.target.value })} placeholder="sozdayotsya-avtomaticheski" /></label>
                  </div>
                  <label className="admin-full-field"><span>Аннотация</span><textarea value={bookForm.synopsis} onChange={(event) => setBookForm({ ...bookForm, synopsis: event.target.value })} placeholder="Расскажите читателю, о чём эта история…" rows={7} /><small>{bookForm.synopsis.length} / 12 000</small></label>
                  <div className="admin-fields two-columns">
                    <label><span>Жанры</span><input value={bookForm.genres.join(', ')} onChange={(event) => setBookForm({ ...bookForm, genres: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="Романтика, Фэнтези" /></label>
                    <label><span>Статус перевода</span><select value={bookForm.status} onChange={(event) => setBookForm({ ...bookForm, status: event.target.value })}><option>Черновик</option><option>Скоро</option><option>В работе</option><option>Новый перевод</option><option>Готово</option><option>На паузе</option></select></label>
                    <label><span>Готовность перевода: {bookForm.progress}%</span><input type="range" min="0" max="100" value={bookForm.progress} onChange={(event) => setBookForm({ ...bookForm, progress: Number(event.target.value) })} /></label>
                    <label className="admin-switch-row"><span><strong>Показывать книгу на сайте</strong><small>Читатели увидят аннотацию и опубликованные главы.</small></span><input type="checkbox" checked={bookForm.published} onChange={(event) => setBookForm({ ...bookForm, published: event.target.checked })} /></label>
                  </div>
                </section>
              </div>

              <aside className="admin-form-side">
                <section className="admin-form-card admin-cover-card">
                  <div className="admin-card-title compact"><span>02</span><div><h2>Обложка</h2><p>JPG, PNG или WEBP до 8 МБ.</p></div></div>
                  <div className="admin-cover-preview">
                    {bookForm.coverUrl ? <img src={bookForm.coverUrl} alt="Обложка книги" /> : <><ImagePlus size={38} /><strong>{bookForm.title || 'Обложка книги'}</strong><small>BOOKNERD EDITION</small></>}
                  </div>
                  <label className="admin-upload-button">{uploading ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />} {uploading ? 'Загрузка…' : 'Загрузить обложку'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadCover} disabled={uploading} /></label>
                </section>
                <button className="admin-primary admin-save-book" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} {saving ? 'Сохраняем…' : 'Сохранить книгу'}</button>
              </aside>
            </form>

            <section className={`admin-chapter-section ${!bookForm.id ? 'is-disabled' : ''}`}>
              <div className="admin-list-head">
                <div><span>03 / ГЛАВЫ</span><h2>Текст перевода</h2><p>Добавляйте главы, храните черновики и публикуйте готовый текст.</p></div>
                <button className="admin-secondary" onClick={startNewChapter} disabled={!bookForm.id}><Plus size={18} /> Новая глава</button>
              </div>
              {!bookForm.id ? (
                <EmptyState title="Сначала сохраните книгу" text="После сохранения здесь появится редактор глав." />
              ) : (
                <div className="admin-chapter-workspace">
                  <aside className="admin-chapter-list">
                    {chapters.length ? chapters.map((chapter) => (
                      <button key={chapter.id} className={chapterForm.id === chapter.id ? 'is-active' : ''} onClick={() => setChapterForm(chapter)}>
                        <span>{String(chapter.chapterNumber).padStart(2, '0')}</span><div><strong>{chapter.title}</strong><small>{chapter.status === 'published' ? 'Опубликована' : 'Черновик'}</small></div><ChevronRight size={17} />
                      </button>
                    )) : <p className="admin-no-chapters">Глав пока нет. Создайте первую.</p>}
                  </aside>
                  <form className="admin-chapter-editor" onSubmit={saveChapter}>
                    <div className="admin-chapter-editor-top">
                      <label><span>Номер</span><input type="number" min="1" value={chapterForm.chapterNumber} onChange={(event) => setChapterForm({ ...chapterForm, chapterNumber: Number(event.target.value) })} /></label>
                      <label className="grow"><span>Название главы</span><input value={chapterForm.title} onChange={(event) => setChapterForm({ ...chapterForm, title: event.target.value })} placeholder="Название главы" /></label>
                      <label><span>Статус</span><select value={chapterForm.status} onChange={(event) => setChapterForm({ ...chapterForm, status: event.target.value })}><option value="draft">Черновик</option><option value="published">Опубликована</option></select></label>
                    </div>
                    <label className="admin-chapter-body"><span>Текст главы</span><textarea value={chapterForm.body} onChange={(event) => setChapterForm({ ...chapterForm, body: event.target.value })} placeholder="Вставьте сюда текст переведённой главы…" /></label>
                    <div className="admin-chapter-actions">
                      {chapterForm.id && <button type="button" className="admin-danger" onClick={deleteChapter}><Trash2 size={17} /> Удалить</button>}
                      <span>{chapterForm.body.length.toLocaleString('ru-RU')} знаков</span>
                      <button className="admin-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Сохранить главу</button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          </section>
        )}

        {view === 'team' && currentUser.role === 'owner' && (
          <section className="admin-content admin-team-page">
            <div className="admin-hero-row">
              <div><span className="admin-kicker">ДОСТУП К РЕДАКЦИОННОЙ</span><h1>Твоя <em>команда.</em></h1><p>Добавляйте только тех, кому доверяете книги, главы и публикацию.</p></div>
            </div>
            <div className="admin-team-layout">
              <form className="admin-invite-card" onSubmit={addTeamMember}>
                <Users size={30} />
                <h2>Добавить участника</h2>
                <p>Введите email, который участник использует в ChatGPT. После этого он сможет войти в панель.</p>
                <label><span>Email участника</span><input type="email" value={teamEmail} onChange={(event) => setTeamEmail(event.target.value)} placeholder="name@example.com" required /></label>
                <button className="admin-primary" type="submit"><Plus size={18} /> Открыть доступ</button>
              </form>
              <section className="admin-team-list">
                <div className="admin-card-title"><span>01</span><div><h2>Участники редакционной</h2><p>{team.length} человек с доступом</p></div></div>
                {team.map((member) => (
                  <article key={member.email}>
                    <div className="admin-avatar">{member.email.slice(0, 1).toUpperCase()}</div>
                    <div><strong>{member.role === 'owner' ? 'Создатель BOOKNERD' : 'Участник команды'}</strong><span>{member.email}</span></div>
                    <b>{member.role === 'owner' ? 'Полный доступ' : 'Книги и главы'}</b>
                    {member.role !== 'owner' && <button onClick={() => removeTeamMember(member.email)} aria-label={`Закрыть доступ для ${member.email}`}><Trash2 size={17} /></button>}
                  </article>
                ))}
              </section>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
