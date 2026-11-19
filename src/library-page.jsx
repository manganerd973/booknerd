'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bookmark, BookOpen, Check, Grid3X3, Heart, Library, List, LoaderCircle, XCircle, Search, FolderPlus } from 'lucide-react';
import { LIBRARY_STATUS, loadReaderLibrary, updateReaderLibrary } from './reader-library.jsx';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';
import { ShelfBook } from './book-shelves.jsx';

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

function LibraryBookCard({ book, item, onStatusChange, folders, folderId, onFolderChange }) {
  const Icon = STATUS_ICON[item.status] || Bookmark;
  const start = `/books/${book.slug}`;
  const resume = item.lastChapterId ? `${start}/chapters/${item.lastChapterId}?page=${Number(item.lastPage || 0) + 1}` : start;
  return (
    <article className="library-page-card">
      <ShelfBook book={book} overlay badge={LIBRARY_STATUS[item.status]?.label} />
      <div className="library-page-card-copy">
        <a className="library-page-open" href={resume}><Icon size={15} />{item.lastChapterId ? `Продолжить · гл. ${item.chapterNumber || '—'}` : 'Начать читать'}</a>
        <label>
          <span>Раздел библиотеки</span>
          <select aria-label="Раздел библиотеки" value={item.status} onChange={(event) => onStatusChange(item, event.target.value)}>
            {Object.entries(LIBRARY_STATUS).map(([value, option]) => <option value={value} key={value}>{option.short}</option>)}
          </select>
        </label>
        {folders.length > 0 && <label>
          <span>Папка</span>
          <select aria-label={`Папка для книги «${book.title}»`} value={folderId || ''} onChange={(event) => onFolderChange(book.id, event.target.value)}>
            <option value="">Без папки</option>
            {folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
          </select>
        </label>}
      </div>
    </article>
  );
}

export default function LibraryPage({ initialBooks = [] }) {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [folders, setFolders] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [activeFolder, setActiveFolder] = useState('');
  const [folderName, setFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const booksById = useMemo(() => new Map(initialBooks.map((book) => [book.id, book])), [initialBooks]);
  const visibleItems = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('ru');
    const results = items.filter((item) => {
      const book = booksById.get(item.bookId);
      return book && (activeTab === 'all' || item.status === activeTab) &&
        (!activeFolder || assignments[item.bookId] === activeFolder) &&
        `${book.title} ${book.author}`.toLocaleLowerCase('ru').includes(text);
    });
    if (sort === 'title') results.sort((a, b) => booksById.get(a.bookId).title.localeCompare(booksById.get(b.bookId).title, 'ru'));
    if (sort === 'updated') results.sort((a, b) => String(booksById.get(b.bookId).lastPublishedAt || '').localeCompare(String(booksById.get(a.bookId).lastPublishedAt || '')));
    return results;
  }, [activeFolder, activeTab, assignments, booksById, items, query, sort]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('booknerd:library-folders') || '{}');
      setFolders(saved.folders || []);
      setAssignments(saved.assignments || {});
    } catch { /* Use empty folders if browser storage is unavailable. */ }
  }, []);

  const saveFolders = (nextFolders, nextAssignments) => {
    setFolders(nextFolders);
    setAssignments(nextAssignments);
    try {
      localStorage.setItem('booknerd:library-folders', JSON.stringify({ folders: nextFolders, assignments: nextAssignments }));
    } catch { setNotice('Папки не удалось сохранить в этом браузере.'); }
  };

  const createFolder = (event) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    if (folders.some((folder) => folder.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      setNotice('Папка с таким названием уже есть.');
      return;
    }
    saveFolders([...folders, { id: crypto.randomUUID(), name }], assignments);
    setAddingFolder(false);
    setFolderName('');
  };

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
      // The default grid view still works when browser storage is unavailable.
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
    <div className="site-shell inner-site-shell library-page shelf-page">
      <SiteHeader active="library" compact />
      <main>
        <section className="shelf-content">
          <div className="shelf-page-heading"><h1>Моя библиотека</h1></div>
          <div className="shelf-tabs" role="group" aria-label="Разделы моей библиотеки">
            {LIBRARY_TABS.map(([value, label]) => (
              <button type="button" aria-pressed={activeTab === value} onClick={() => setActiveTab(value)} key={value}>{label}</button>
            ))}
          </div>
          <label className="shelf-search"><Search size={18} /><input aria-label="Найти в библиотеке" placeholder="Найти в библиотеке" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="shelf-library-controls">
            <select aria-label="Порядок книг" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="updated">По обновлению главы</option><option value="recent">По последнему чтению</option><option value="title">По названию</option>
            </select>
            <div role="group" aria-label="Вид книжной полки">
              <button className="shelf-control" type="button" aria-pressed={viewMode === 'list'} onClick={() => changeView('list')} aria-label="Список"><List size={17} /></button>
              <button className="shelf-control" type="button" aria-pressed={viewMode === 'grid'} onClick={() => changeView('grid')} aria-label="Плитка"><Grid3X3 size={17} /></button>
            </div>
          </div>
          <div className="shelf-library-controls">
            <select aria-label="Папки" value={activeFolder} onChange={(event) => setActiveFolder(event.target.value)}>
              <option value="">Все папки</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            <button className="shelf-control" type="button" aria-expanded={addingFolder} onClick={() => setAddingFolder(!addingFolder)}><FolderPlus size={16} /> Новая папка</button>
          </div>
          {addingFolder && <form className="shelf-library-controls" onSubmit={createFolder}>
            <input className="shelf-control" aria-label="Название папки" placeholder="Название папки" maxLength={50} required value={folderName} onChange={(event) => setFolderName(event.target.value)} />
            <button className="shelf-control" type="submit">Создать</button>
          </form>}

          {loading ? <div className="library-page-loading"><LoaderCircle className="spin" size={25} /> Открываем ваши полки…</div> : visibleItems.length ? (
            <div className={`library-page-grid is-${viewMode}`}>
              {visibleItems.map((item) => <LibraryBookCard book={booksById.get(item.bookId)} item={item} onStatusChange={changeStatus}
                folders={folders} folderId={assignments[item.bookId]} onFolderChange={(bookId, folderId) => saveFolders(folders, { ...assignments, [bookId]: folderId })} key={item.bookId} />)}
            </div>
          ) : (
            <div className="library-page-empty">
              <Library size={38} />
              <div><strong>{items.length ? 'Книги не найдены' : 'Ваша библиотека ждёт первую книгу'}</strong><p>Откройте переводы и добавьте историю на нужную полку.</p></div>
              <a href="/translations">Выбрать книгу <ArrowRight size={17} /></a>
            </div>
          )}


        </section>
      </main>
      <SiteFooter />
      {notice ? <div className="toast" role="status"><Check size={17} />{notice}</div> : null}
    </div>
  );
}
