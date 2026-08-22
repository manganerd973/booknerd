'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpDown, Bookmark, BookOpen, Check, Clock3, Grid3X3, Heart, Library, List, LoaderCircle, Search, XCircle } from 'lucide-react';
import { ReaderStatistics } from './home-reader-features.jsx';
import { LIBRARY_STATUS, loadReaderLibrary, updateReaderLibrary } from './reader-library.jsx';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const LIBRARY_TABS = [
  ['all', 'Все'],
  ['reading', 'Читаю'],
  ['saved', 'В планах'],
  ['dropped', 'Брошено'],
  ['finished', 'Прочитано'],
  ['favorite', 'Любимые'],
  ['history', 'История'],
];

const SORT_OPTIONS = [
  ['updated', 'По обновлению главы'],
  ['recent', 'По последнему чтению'],
  ['added', 'По дате добавления'],
  ['title', 'По названию'],
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

function formatLastOpened(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
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
        {item.chapterNumber != null ? (
          <div className="library-reading-history"><Clock3 size={13} /><span>Остановились: глава {item.chapterNumber}{item.lastPage > 0 ? ` · страница ${item.lastPage + 1}` : ''}</span>{item.lastOpenedAt ? <time>{formatLastOpened(item.lastOpenedAt)}</time> : null}</div>
        ) : null}
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
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('updated');
  const booksById = useMemo(() => new Map(initialBooks.map((book) => [book.id, book])), [initialBooks]);
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    return items
      .filter((item) => {
        const book = booksById.get(item.bookId);
        if (!book) return false;
        const inTab = activeTab === 'all' || (activeTab === 'history' ? Boolean(item.lastChapterId) : item.status === activeTab);
        const inSearch = !normalized || `${book.title} ${book.author} ${book.seriesTitle || ''}`.toLocaleLowerCase('ru-RU').includes(normalized);
        return inTab && inSearch;
      })
      .sort((left, right) => {
        const leftBook = booksById.get(left.bookId);
        const rightBook = booksById.get(right.bookId);
        if (sortMode === 'title') return String(leftBook?.title || '').localeCompare(String(rightBook?.title || ''), 'ru-RU');
        if (sortMode === 'recent') return new Date(right.lastOpenedAt || 0) - new Date(left.lastOpenedAt || 0);
        if (sortMode === 'added') return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
        return new Date(rightBook?.updatedAt || right.updatedAt || 0) - new Date(leftBook?.updatedAt || left.updatedAt || 0);
      });
  }, [activeTab, booksById, items, query, sortMode]);

  const tabCount = (value) => {
    const available = items.filter((item) => booksById.has(item.bookId));
    if (value === 'all') return available.length;
    if (value === 'history') return available.filter((item) => item.lastChapterId).length;
    return available.filter((item) => item.status === value).length;
  };

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (LIBRARY_TABS.some(([value]) => value === requestedTab)) setActiveTab(requestedTab);
  }, []);

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

  const changeTab = (nextTab) => {
    setActiveTab(nextTab);
    const url = new URL(window.location.href);
    if (nextTab === 'all') url.searchParams.delete('tab');
    else url.searchParams.set('tab', nextTab);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <div className="site-shell inner-site-shell library-page">
      <SiteHeader active="library" />
      <main>
        <section className="inner-hero library-hero">
          <span className="section-number">02 / ЗАКЛАДКИ</span>
          <div><h1>Моя библиотека</h1><p>Все сохранённые истории, прогресс чтения и история — в одном месте.</p></div>
        </section>

        <section className="library-page-content">
          <div className="library-page-tabs" role="tablist" aria-label="Разделы моей библиотеки">
            {LIBRARY_TABS.map(([value, label]) => (
              <button type="button" role="tab" aria-selected={activeTab === value} className={activeTab === value ? 'is-active' : ''} onClick={() => changeTab(value)} key={value}>
                {label}<span>{tabCount(value)}</span>
              </button>
            ))}
          </div>

          <div className="library-page-tools">
            <label className="library-page-search">
              <span className="sr-only">Найти в библиотеке</span>
              <Search size={20} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти в библиотеке…" />
            </label>
            <label className="library-page-sort">
              <span><ArrowUpDown size={16} /> Сортировка</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                {SORT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <div className="library-view-controls" role="group" aria-label="Вид книжной полки">
              <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => changeView('list')} aria-pressed={viewMode === 'list'} aria-label="Показать списком">
                <List size={17} /><span>Список</span>
              </button>
              <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => changeView('grid')} aria-pressed={viewMode === 'grid'} aria-label="Показать плиткой">
                <Grid3X3 size={17} /><span>Плитка</span>
              </button>
            </div>
          </div>

          {loading ? <div className="library-page-loading"><LoaderCircle className="spin" size={25} /> Открываем ваши полки…</div> : visibleItems.length ? (
            <div className={`library-page-grid is-${viewMode}`}>
              {visibleItems.map((item) => <LibraryBookCard book={booksById.get(item.bookId)} item={item} onStatusChange={changeStatus} key={item.bookId} />)}
            </div>
          ) : (
            <div className="library-page-empty">
              <Library size={38} />
              <div><strong>{query ? 'По вашему запросу ничего не найдено' : items.length ? 'В этом разделе пока пусто' : 'Ваши закладки ждут первую книгу'}</strong><p>{query ? 'Попробуйте другое название или имя автора.' : 'Откройте каталог и добавьте историю на нужную полку.'}</p></div>
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
