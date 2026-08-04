'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bookmark, BookOpen, Check, Grid3X3, Heart, Library, List, LoaderCircle, XCircle } from 'lucide-react';
import { ContinueReading, ReaderStatistics } from './home-reader-features.jsx';
import NotificationControl from './notification-control.jsx';
import { LIBRARY_STATUS, loadReaderLibrary, updateReaderLibrary } from './reader-library.jsx';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const LIBRARY_TABS = [
  ['all', 'Все'],
  ['reading', 'Читаю'],
  ['finished', 'Прочитано'],
  ['saved', 'В планах'],
  ['favorite', 'Любимые'],
  ['dropped', 'Брошено'],
];

const STATUS_ICON = {
  saved: Bookmark,
  reading: BookOpen,
  finished: Check,
  favorite: Heart,
  dropped: XCircle,
};

function chapterWord(value) {
  const count = Math.abs(Number(value || 0));
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'глав';
  if (last === 1) return 'глава';
  if (last >= 2 && last <= 4) return 'главы';
  return 'глав';
}

function LibraryCover({ book }) {
  const chapterCount = Number(book.publishedChapterCount ?? book.chapterCount ?? 0);
  const completed = book.status === 'Завершено';
  return (
    <div className={`library-page-cover cover-${book.cover || 'garden'} ${book.coverUrl ? 'has-image' : ''}`}>
      {book.coverUrl ? <img src={book.coverUrl} alt={`Обложка книги «${book.title}»`} /> : <><span>BOOKNERD</span><strong>{book.title}</strong><small>{book.author}</small></>}
      <div className="library-cover-meta"><strong>{chapterCount} {chapterWord(chapterCount)}</strong><small>{completed ? 'Завершено' : 'Онгоинг'}</small></div>
    </div>
  );
}

function LibraryBookCard({ book, item, onStatusChange }) {
  const Icon = STATUS_ICON[item.status] || Bookmark;
  return (
    <article className="library-page-card">
      <a href={`/books/${book.slug}`} className="library-page-cover-link"><LibraryCover book={book} /></a>
      <div className="library-page-card-copy">
        <span><Icon size={14} /> {LIBRARY_STATUS[item.status]?.label || 'В планах'}</span>
        <h2><a href={`/books/${book.slug}`}>{book.title}</a></h2>
        <p>{book.author}</p>
        <label>
          <span>Раздел библиотеки</span>
          <select value={item.status} onChange={(event) => onStatusChange(item, event.target.value)}>
            {Object.entries(LIBRARY_STATUS).map(([value, option]) => <option value={value} key={value}>{option.short}</option>)}
          </select>
        </label>
        <a className="library-page-open" href={`/books/${book.slug}`}>Открыть книгу <ArrowRight size={17} /></a>
      </div>
    </article>
  );
}

export default function LibraryPage({ initialBooks = [] }) {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const booksById = useMemo(() => new Map(initialBooks.map((book) => [book.id, book])), [initialBooks]);
  const visibleItems = useMemo(() => items.filter((item) => booksById.has(item.bookId) && (activeTab === 'all' || item.status === activeTab)), [activeTab, booksById, items]);

  useEffect(() => {
    let active = true;
    loadReaderLibrary()
      .then((result) => { if (active) setItems(result); })
      .catch((error) => { if (active) setNotice(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem('booknerd:library-view');
      if (savedView === 'grid' || savedView === 'list') setViewMode(savedView);
    } catch {
      // The default list view still works when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const changeStatus = async (item, status) => {
    const previous = items;
    setItems((current) => current.map((entry) => entry.bookId === item.bookId ? { ...entry, status } : entry));
    try {
      const saved = await updateReaderLibrary({ bookId: item.bookId, status, progress: item.progress || 0 });
      setItems((current) => current.map((entry) => entry.bookId === item.bookId ? { ...entry, ...saved } : entry));
      setNotice(`Книга перенесена в «${LIBRARY_STATUS[status].short}».`);
    } catch (error) {
      setItems(previous);
      setNotice(error.message);
    }
  };

  const changeView = (nextView) => {
    setViewMode(nextView);
    try { window.localStorage.setItem('booknerd:library-view', nextView); } catch { /* Preference remains active for this visit. */ }
  };

  return (
    <div className="site-shell inner-site-shell library-page">
      <SiteHeader active="library" />
      <main>
        <section className="inner-hero library-hero">
          <span className="section-number">02 / МОЯ БИБЛИОТЕКА</span>
          <div><h1>Ваши истории,<br /><em>на своих полках.</em></h1><p>Читаемое, любимое, запланированное и уже прочитанное — теперь на отдельной странице.</p></div>
        </section>

        <section className="library-page-content">
          <div className="library-page-tabs" role="tablist" aria-label="Разделы моей библиотеки">
            {LIBRARY_TABS.map(([value, label]) => (
              <button type="button" role="tab" aria-selected={activeTab === value} className={activeTab === value ? 'is-active' : ''} onClick={() => setActiveTab(value)} key={value}>
                {label}<span>{value === 'all' ? items.length : items.filter((item) => item.status === value).length}</span>
              </button>
            ))}
          </div>

          <NotificationControl />
          <ContinueReading items={items} books={initialBooks} />

          <div className="library-view-controls" role="group" aria-label="Вид книжной полки">
            <span>Вид полки</span>
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => changeView('list')} aria-pressed={viewMode === 'list'}>
              <List size={17} /> Список
            </button>
            <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => changeView('grid')} aria-pressed={viewMode === 'grid'}>
              <Grid3X3 size={17} /> Плитка
            </button>
          </div>

          {loading ? <div className="library-page-loading"><LoaderCircle className="spin" size={25} /> Открываем ваши полки…</div> : visibleItems.length ? (
            <div className={`library-page-grid is-${viewMode}`}>
              {visibleItems.map((item) => <LibraryBookCard book={booksById.get(item.bookId)} item={item} onStatusChange={changeStatus} key={item.bookId} />)}
            </div>
          ) : (
            <div className="library-page-empty">
              <Library size={38} />
              <div><strong>{items.length ? 'В этом разделе пока пусто' : 'Ваша библиотека ждёт первую книгу'}</strong><p>Откройте переводы и добавьте историю на нужную полку.</p></div>
              <a href="/translations">Выбрать книгу <ArrowRight size={17} /></a>
            </div>
          )}

          <ReaderStatistics />
        </section>
      </main>
      <SiteFooter />
      {notice ? <div className="toast" role="status"><Check size={17} />{notice}</div> : null}
    </div>
  );
}
