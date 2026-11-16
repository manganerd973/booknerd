'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Layers, Search, SlidersHorizontal, X } from 'lucide-react';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';
import { bookCollections, booksForShelf, CollectionTile, ShelfBook } from './book-shelves.jsx';
import { loadReaderLibrary, LIBRARY_STATUS } from './reader-library.jsx';

const EMPTY = { type: '', year: '', age: '', illustrated: false, min: '', max: '', statuses: [], hideLibrary: false, genres: [], excluded: [] };

function FilterOptions({ values, selected, onChange }) {
  return values.map(([value, label]) => (
    <label className="catalog-check" key={value}>
      <input type="checkbox" checked={selected.includes(value)} onChange={(event) => onChange(event.target.checked ? [...selected, value] : selected.filter((entry) => entry !== value))} />
      {label}
    </label>
  ));
}

export default function TranslationsPage({ initialBooks = [], initialView = 'all', collectionKey = '' }) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const [draft, setDraft] = useState(EMPTY);
  const [library, setLibrary] = useState([]);
  const panel = useRef(null);

  useEffect(() => {
    const refresh = () => loadReaderLibrary().then(setLibrary).catch(() => {});
    refresh();
    window.addEventListener('booknerd-library-change', refresh);
    return () => window.removeEventListener('booknerd-library-change', refresh);
  }, []);

  const collections = bookCollections(initialBooks);
  const collection = collections.find((entry) => entry.key === collectionKey);
  const source = collection && view === 'all' ? collection.books : booksForShelf(initialBooks, view);
  const genres = [...new Set(initialBooks.flatMap((book) => book.genres || []))].sort((a, b) => a.localeCompare(b, 'ru'));
  const types = [...new Set(initialBooks.map((book) => book.bookType).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const years = [...new Set(initialBooks.map((book) => book.publicationYear).filter(Boolean))].sort((a, b) => b - a);
  const libraryById = new Map(library.map((item) => [item.bookId, item.status]));
  const text = query.trim().toLocaleLowerCase('ru');
  const matches = source.filter((book) => {
    const bookGenres = book.genres || [];
    const chapters = book.publishedChapterCount || 0;
    return (!filters.type || book.bookType === filters.type)
      && (!filters.year || String(book.publicationYear) === filters.year)
      && (!filters.age || (book.ageRating != null && (filters.age === '18' ? book.ageRating >= 18 : book.ageRating < 18)))
      && (!filters.illustrated || book.hasIllustrations)
      && (filters.min === '' || chapters >= Number(filters.min))
      && (filters.max === '' || chapters <= Number(filters.max))
      && (!filters.statuses.length || filters.statuses.includes(libraryById.get(book.id)))
      && (!filters.hideLibrary || !libraryById.has(book.id))
      && (!filters.genres.length || filters.genres.some((genre) => bookGenres.includes(genre)))
      && !filters.excluded.some((genre) => bookGenres.includes(genre))
      && [book.title, book.author, ...bookGenres, ...(book.tropes || [])].join(' ').toLocaleLowerCase('ru').includes(text);
  });
  const changeDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const apply = (event) => {
    event.preventDefault();
    if (draft.min !== '' && draft.max !== '' && Number(draft.min) > Number(draft.max)) {
      event.currentTarget.elements.max.setCustomValidity('Максимум должен быть не меньше минимума.');
      event.currentTarget.elements.max.reportValidity();
      return;
    }
    setFilters(draft);
    panel.current.close();
  };

  return (
    <div className="site-shell inner-site-shell shelf-page">
      <SiteHeader active="translations" compact />
      <main className="shelf-content">
        <div className="shelf-page-heading">
          <h1>{view === 'collections' ? 'Подборки' : collection && view === 'all' ? collection.title : ({ new: 'Новинки', finished: 'Завершённые', rated: 'Выбор читателей', recommended: 'Рекомендуем вам' }[view] || 'Каталог переводов')}</h1>
          <button className="shelf-control" type="button" onClick={() => { setView(view === 'collections' ? 'all' : 'collections'); setFilters(EMPTY); }}>
            <Layers size={17} />{view === 'collections' ? 'К каталогу' : 'Подборки'}
          </button>
        </div>
        {view === 'collections' ? (
          <div className="shelf-collection-grid">{collections.map((entry) => <CollectionTile key={entry.key} collection={entry} />)}</div>
        ) : <>
          {(collection || view !== 'all') && <a className="shelf-back" href={collection ? '/translations?view=collections' : '/translations'}>← {collection ? 'Все подборки' : 'Весь каталог'}</a>}
          <div className="shelf-toolbar">
            <label className="shelf-search"><Search size={18} /><input aria-label="Название или автор" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или автор" /></label>
            <button className="shelf-control" type="button" aria-haspopup="dialog" onClick={() => { setDraft(filters); panel.current.showModal(); }}><SlidersHorizontal size={17} /> Фильтры</button>
          </div>
          <div className="shelf-results"><span>Найдено <strong>{matches.length}</strong></span></div>
          {matches.length ? <div className="shelf-book-grid">{matches.map((book) => <ShelfBook key={book.id} book={book} overlay badge={book.ageRating === 18 ? '18+' : undefined} />)}</div> : <p className="shelf-empty">В этом разделе пока нет подходящих книг.</p>}
        </>}
        <dialog ref={panel} className="catalog-filter-panel" aria-labelledby="catalog-filters-title">
          <form onSubmit={apply} onChange={(event) => event.currentTarget.elements.max.setCustomValidity('')}>
            <div className="catalog-filter-header"><h2 id="catalog-filters-title">Фильтры</h2><button className="shelf-control" type="button" aria-label="Закрыть" onClick={() => panel.current.close()}><X size={19} /></button></div>
            <label>Тип<select value={draft.type} onChange={(event) => changeDraft('type', event.target.value)}><option value="">Все типы</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Год выпуска<select value={draft.year} onChange={(event) => changeDraft('year', event.target.value)}><option value="">Все годы</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
            <fieldset><legend>Возрастной рейтинг</legend>{[['', 'Все'], ['under', 'Без 18+'], ['18', 'Только 18+']].map(([key, label]) =>
              <label className="catalog-check" key={key}><input type="radio" name="age" checked={draft.age === key} onChange={() => changeDraft('age', key)} />{label}</label>
            )}</fieldset>
            <label className="catalog-check"><input type="checkbox" checked={draft.illustrated} onChange={(event) => changeDraft('illustrated', event.target.checked)} /> Только с иллюстрациями</label>
            <fieldset><legend>Количество глав</legend><div className="catalog-range">
              <input name="min" className="shelf-control" type="number" min="0" aria-label="От глав" placeholder="От" value={draft.min} onChange={(event) => changeDraft('min', event.target.value)} />
              <input name="max" className="shelf-control" type="number" min="0" aria-label="До глав" placeholder="До" value={draft.max} onChange={(event) => changeDraft('max', event.target.value)} />
            </div></fieldset>
            <fieldset><legend>Мои списки</legend>
              <FilterOptions values={['reading', 'saved', 'dropped', 'finished', 'favorite'].map((key) => [key, LIBRARY_STATUS[key].label])} selected={draft.statuses} onChange={(value) => setDraft({ ...draft, statuses: value, hideLibrary: value.length ? false : draft.hideLibrary })} />
              <label className="catalog-check"><input type="checkbox" checked={draft.hideLibrary} onChange={(event) => setDraft({ ...draft, statuses: event.target.checked ? [] : draft.statuses, hideLibrary: event.target.checked })} /> Скрыть книги из библиотеки</label>
            </fieldset>
            <details><summary>Жанры</summary><FilterOptions values={genres.map((genre) => [genre, genre])} selected={draft.genres} onChange={(value) => changeDraft('genres', value)} /></details>
            <details><summary>Исключить жанры</summary><FilterOptions values={genres.map((genre) => [genre, genre])} selected={draft.excluded} onChange={(value) => changeDraft('excluded', value)} /></details>
            <div className="catalog-filter-actions">
              <button className="shelf-control" type="button" onClick={() => { panel.current.querySelector('[name="max"]').setCustomValidity(''); setDraft(EMPTY); }}>Сбросить</button>
              <button className="shelf-control" type="submit">Показать</button>
            </div>
          </form>
        </dialog>
      </main>
      <SiteFooter />
    </div>
  );
}
