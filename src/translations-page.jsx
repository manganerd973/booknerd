'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpDown, BookOpen, Check, ChevronDown, Dices, Grid3X3, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';
import { genreKey, uniqueGenres } from '../lib/genres.js';

const CATALOG_VIEW_KEY = 'booknerd-catalog-view-v1';
const CATALOG_SORT_KEY = 'booknerd-catalog-sort-v1';
const SORT_OPTIONS = [
  ['default', 'Сначала новые обновления'],
  ['title', 'По названию'],
  ['chapters', 'По количеству глав'],
  ['progress', 'По прогрессу перевода'],
  ['created', 'По дате добавления'],
];
const STATUS_OPTIONS = [['all', 'Все книги'], ['ongoing', 'Переводятся'], ['finished', 'Завершённые']];
const AGE_OPTIONS = [['all', 'Любой возрастной рейтинг'], ['16', '16+'], ['18', '18+']];

function TranslationCover({ book }) {
  const published = Number(book.publishedChapterCount || 0);
  const status = `${book.status}${published ? ` · ${published} гл.` : ''}`;
  return (
    <div className={`translation-cover cover-${book.cover || 'garden'}`}>
      {book.coverUrl
        ? <img src={book.coverUrl} alt={`Обложка книги «${book.title}»`} />
        : <><span className="translation-cover-brand">перевод booknerd</span><b>{book.number || 'BN'}</b><strong>{book.title}</strong><small>{book.author}</small></>}
      <span className="translation-cover-status">{status}</span>
      {book.ageRating ? <span className="translation-cover-age">{book.ageRating}</span> : null}
      <span className="translation-cover-meta"><em>{book.genre || 'Книга'}</em><strong>✦ {book.progress}%</strong></span>
    </div>
  );
}

export default function TranslationsPage({ initialBooks = [] }) {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('Все');
  const [viewMode, setViewMode] = useState('grid');
  const [sortKey, setSortKey] = useState('default');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [panel, setPanel] = useState('');
  const genres = useMemo(() => ['Все', ...uniqueGenres(initialBooks.flatMap((book) => book.genres || []))], [initialBooks]);
  const books = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = initialBooks.filter((book) => {
      const matchesGenre = genre === 'Все' || book.genres?.some((item) => genreKey(item) === genreKey(genre));
      const matchesQuery = !normalized || `${book.title} ${book.author} ${(book.genres || []).join(' ')} ${(book.tropes || []).join(' ')}`.toLowerCase().includes(normalized);
      const finished = String(book.status || '').toLowerCase().includes('заверш');
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'finished' ? finished : !finished);
      const matchesAge = ageFilter === 'all' || String(book.ageRating || '').startsWith(ageFilter);
      return matchesGenre && matchesQuery && matchesStatus && matchesAge;
    });
    return [...filtered].sort((left, right) => {
      if (sortKey === 'title') return String(left.title || '').localeCompare(String(right.title || ''), 'ru');
      if (sortKey === 'chapters') return Number(right.publishedChapterCount || 0) - Number(left.publishedChapterCount || 0);
      if (sortKey === 'progress') return Number(right.progress || 0) - Number(left.progress || 0);
      if (sortKey === 'created') return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
      return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    });
  }, [ageFilter, genre, initialBooks, query, sortKey, statusFilter]);

  useEffect(() => {
    try {
      setViewMode(localStorage.getItem(CATALOG_VIEW_KEY) === 'list' ? 'list' : 'grid');
      const savedSort = localStorage.getItem(CATALOG_SORT_KEY);
      if (SORT_OPTIONS.some(([key]) => key === savedSort)) setSortKey(savedSort);
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    if (!panel) return undefined;
    const close = (event) => { if (event.key === 'Escape') setPanel(''); };
    document.body.classList.add('catalog-panel-open');
    window.addEventListener('keydown', close);
    return () => {
      document.body.classList.remove('catalog-panel-open');
      window.removeEventListener('keydown', close);
    };
  }, [panel]);

  const chooseView = (nextView) => {
    setViewMode(nextView);
    try { localStorage.setItem(CATALOG_VIEW_KEY, nextView); } catch { /* optional */ }
  };
  const chooseSort = (nextSort) => {
    setSortKey(nextSort);
    try { localStorage.setItem(CATALOG_SORT_KEY, nextSort); } catch { /* optional */ }
    setPanel('');
  };
  const chooseRandom = () => {
    const pool = books.length ? books : initialBooks;
    if (!pool.length) return;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    window.location.href = `/books/${chosen.slug}`;
  };

  return (
    <div className="site-shell inner-site-shell">
      <SiteHeader active="translations" />
      <main>
        <section className="inner-hero translations-hero">
          <span className="section-number">01 / ПЕРЕВОДЫ</span>
          <div><h1>Книги, которые<br /><em>говорят нашим голосом.</em></h1><p>Открывайте аннотации, выбирайте главы и читайте онлайн прямо на сайте.</p></div>
        </section>
        <section className="translations-library">
          <div className="translations-tools">
            <div className="filter-list">{genres.map((item) => <button className={genre === item ? 'active' : ''} onClick={() => setGenre(item)} key={item}>{item}</button>)}</div>
            <div className="translations-actions">
              <button type="button" className="random-book-button catalog-icon-action" onClick={chooseRandom} aria-label="Выбрать случайную книгу"><Dices size={18} /><span>Случайная книга</span></button>
              <button type="button" className="catalog-sort-button" onClick={() => setPanel('sort')}><ArrowUpDown size={17} /><span>{SORT_OPTIONS.find(([key]) => key === sortKey)?.[1] || 'Сортировка'}</span><ChevronDown size={15} /></button>
              <label className="translations-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или автор" /></label>
              <button type="button" className={`catalog-filter-button ${statusFilter !== 'all' || ageFilter !== 'all' ? 'is-active' : ''}`} onClick={() => setPanel('filters')}><SlidersHorizontal size={18} /><span>Фильтры</span>{statusFilter !== 'all' || ageFilter !== 'all' ? <i aria-label="Фильтры включены" /> : null}</button>
              <div className="translations-view-controls" role="group" aria-label="Вид каталога">
                <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => chooseView('grid')} aria-pressed={viewMode === 'grid'} aria-label="Показать книги плиткой"><Grid3X3 size={17} /><span>Плитка</span></button>
                <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => chooseView('list')} aria-pressed={viewMode === 'list'} aria-label="Показать книги списком"><List size={18} /><span>Список</span></button>
              </div>
            </div>
          </div>
          {books.length ? (
            <div className={`translations-grid is-${viewMode}`}>
              {books.map((book) => (
                <article
                  className="translation-card"
                  key={book.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Открыть страницу книги «${book.title}»`}
                  onClick={() => { window.location.href = `/books/${book.slug}`; }}
                  onKeyDown={(event) => { if (event.key === 'Enter') window.location.href = `/books/${book.slug}`; }}
                >
                  <TranslationCover book={book} />
                  <div className="translation-card-copy">
                    <span>{book.status} · {book.progress}%</span>
                    <h2>{book.title}</h2><p>{book.author}</p>
                    {book.seriesTitle ? <small className="translation-series">Серия «{book.seriesTitle}»{book.seriesNumber ? ` · книга ${book.seriesNumber}` : ''}</small> : null}
                    <small>{(book.genres || []).join(' · ')}</small>
                    {(book.tropes || []).length ? <div className="translation-tropes">{book.tropes.slice(0, 4).map((trope) => <span key={trope}>{trope}</span>)}</div> : null}
                    <div className="translation-card-progress"><i style={{ width: `${book.progress}%` }} /></div>
                    <a href={`/books/${book.slug}`}>Открыть книгу <ArrowRight size={18} /></a>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="page-empty"><BookOpen size={38} /><h2>Ничего не нашлось</h2><p>Попробуйте другой жанр или запрос.</p></div>}
        </section>
      </main>
      {panel ? <div className="catalog-panel-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setPanel(''); }}>
        <section className="catalog-panel" role="dialog" aria-modal="true" aria-labelledby="catalog-panel-title">
          <header><div><small>{panel === 'sort' ? 'ПОРЯДОК КНИГ' : 'ТОЧНЫЙ ВЫБОР'}</small><h2 id="catalog-panel-title">{panel === 'sort' ? 'Сортировать по' : 'Фильтры каталога'}</h2></div><button type="button" onClick={() => setPanel('')} aria-label="Закрыть"><X size={20} /></button></header>
          {panel === 'sort' ? <div className="catalog-choice-list">{SORT_OPTIONS.map(([key, label]) => <button type="button" className={sortKey === key ? 'is-active' : ''} onClick={() => chooseSort(key)} key={key}><span>{label}</span>{sortKey === key ? <Check size={18} /> : null}</button>)}</div> : <div className="catalog-filter-groups">
            <fieldset><legend>Статус перевода</legend><div>{STATUS_OPTIONS.map(([key, label]) => <button type="button" className={statusFilter === key ? 'is-active' : ''} onClick={() => setStatusFilter(key)} key={key}>{label}</button>)}</div></fieldset>
            <fieldset><legend>Возрастной рейтинг</legend><div>{AGE_OPTIONS.map(([key, label]) => <button type="button" className={ageFilter === key ? 'is-active' : ''} onClick={() => setAgeFilter(key)} key={key}>{label}</button>)}</div></fieldset>
            <div className="catalog-filter-actions"><button type="button" onClick={() => { setStatusFilter('all'); setAgeFilter('all'); }}>Сбросить</button><button type="button" onClick={() => setPanel('')}>Показать {books.length} книг</button></div>
          </div>}
        </section>
      </div> : null}
      <SiteFooter />
    </div>
  );
}
