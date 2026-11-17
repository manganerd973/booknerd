'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  EyeOff,
  Menu,
  MessageCircle,
  Quote,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { loadReaderLibrary } from './reader-library.jsx';
import { ContinueReading } from './home-reader-features.jsx';
import { SiteLogo as Logo, ProfileMenu, ShelfNavigation, ThemeButton } from './page-chrome.jsx';
import { HomeShelves } from './book-shelves.jsx';

function HeroBookCover({ book, className, onSelect }) {
  const Cover = onSelect ? 'button' : 'a';
  const action = onSelect
    ? { type: 'button', onClick: onSelect, 'aria-label': `Показать книгу «${book.title}»` }
    : { href: `/books/${book.slug}`, 'aria-label': `Открыть книгу «${book.title}»` };

  return (
    <Cover
      className={`mini-cover hero-book-cover cover-${book.cover || 'garden'} ${book.coverUrl ? 'has-image' : ''} ${className}`}
      {...action}
    >
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" />
      ) : (
        <>
          <span className="cover-symbol" aria-hidden="true">✦</span>
          <strong>{book.title}</strong>
          <small>{book.author}</small>
        </>
      )}
    </Cover>
  );
}

function FeaturedBooks({ books }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const featured = useMemo(() => {
    const readable = books.filter((book) => book.publishedChapterCount > 0);
    return [...readable].sort((a, b) => Number(Boolean(b.teamPick)) - Number(Boolean(a.teamPick))).slice(0, 7);
  }, [books]);
  const count = featured.length;
  const book = featured[index];
  if (!book) return null;

  const change = (step) => setIndex((current) => (current + step + count) % count);
  const previous = featured[(index + count - 1) % count];
  const next = featured[(index + 1) % count];

  return (
    <section className="home-feature" aria-label="Книги Booknerd" aria-roledescription="карусель">
      <div
        className="home-feature-shelf"
        onTouchStart={(event) => { touchStart.current = event.touches[0]; }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || count < 2) return;
          const end = event.changedTouches[0];
          const horizontal = end.clientX - start.clientX;
          const vertical = end.clientY - start.clientY;
          if (Math.abs(horizontal) > 45 && Math.abs(horizontal) > Math.abs(vertical)) change(horizontal < 0 ? 1 : -1);
        }}
      >
        {count > 2 && <HeroBookCover book={previous} className="home-cover-side home-cover-previous" onSelect={() => change(-1)} />}
        <HeroBookCover book={book} className="home-cover-current" />
        {count > 1 && <HeroBookCover book={next} className="home-cover-side home-cover-next" onSelect={() => change(1)} />}
        {count > 1 && (
          <>
            <button type="button" className="home-shelf-arrow home-shelf-back" onClick={() => change(-1)} aria-label="Предыдущая книга"><ChevronLeft /></button>
            <button type="button" className="home-shelf-arrow home-shelf-forward" onClick={() => change(1)} aria-label="Следующая книга"><ChevronRight /></button>
          </>
        )}
      </div>
      <div className="home-feature-info" aria-live="polite">
        <h1><a href={`/books/${book.slug}`}>{book.title}</a></h1>
        <p>{book.author}</p>
        <dl>
          <div><dt>Жанр</dt><dd>{book.genre}</dd></div>
          {book.publicationYear && <div><dt>Год</dt><dd>{book.publicationYear}</dd></div>}
          <div><dt>Глав на сайте</dt><dd>{book.publishedChapterCount}</dd></div>
        </dl>
        <a className="home-read-button" href={`/books/${book.slug}`}><BookOpen size={19} /> Читать</a>
      </div>
      {count > 1 && <div className="home-slide-controls" role="group" aria-label="Выбор книги">
        {featured.map((entry, position) => <button type="button" key={entry.id} aria-label={entry.title} aria-pressed={position === index} onClick={() => setIndex(position)} />)}
      </div>}
    </section>
  );
}

function LatestChapters({ chapters, books, libraryByBook }) {
  const [savedOnly, setSavedOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const booksById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const visible = chapters.filter((chapter) => booksById.has(chapter.bookId) && (!savedOnly || libraryByBook.has(chapter.bookId)));

  return (
    <section className="home-updates section" aria-labelledby="home-updates-title">
      <div className="home-section-heading">
        <h2 id="home-updates-title">Обновления</h2>
        <a href="/calendar">Календарь глав <ArrowRight size={16} /></a>
      </div>
      <div className="home-update-filters" role="group" aria-label="Какие обновления показать">
        <button type="button" aria-pressed={!savedOnly} onClick={() => { setSavedOnly(false); setShowAll(false); }}>Все</button>
        <button type="button" aria-pressed={savedOnly} onClick={() => { setSavedOnly(true); setShowAll(false); }}>Мои закладки</button>
      </div>
      {visible.length ? <ul className="home-update-list">
        {(showAll ? visible : visible.slice(0, 6)).map((chapter) => {
          const book = booksById.get(chapter.bookId);
          return <li key={chapter.id}>
            <a href={`/books/${book.slug}/chapters/${chapter.id}`}>
              <span className="home-update-cover">{book.coverUrl ? <img src={book.coverUrl} alt="" loading="lazy" /> : <BookOpen size={20} />}</span>
              <span className="home-update-copy"><strong>{book.title}</strong><small>Глава {chapter.chapterNumber}{chapter.title && chapter.title !== `Глава ${chapter.chapterNumber}` ? ` · ${chapter.title}` : ''}</small></span>
              {chapter.publishedAt && <time dateTime={chapter.publishedAt}>{new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', timeZone: 'Asia/Dushanbe' }).format(new Date(chapter.publishedAt))}</time>}
              <ChevronRight size={17} />
            </a>
          </li>;
        })}
      </ul> : <p className="home-empty">{savedOnly ? 'Среди последних обновлений пока нет книг из вашей библиотеки.' : 'Свежие главы появятся здесь после публикации.'}</p>}
      {visible.length > 6 && <button type="button" className="home-show-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Свернуть' : 'Ещё обновления'}</button>}
    </section>
  );
}

function QuoteOfDay({ quote }) {
  return (
    <section className="quote-of-day section" aria-labelledby="quote-of-day-title">
      <div className="quote-of-day-card">
        <div className="quote-of-day-topline"><span>01 / ЦИТАТА ДНЯ</span><Quote size={28} /></div>
        {quote ? (
          <>
            <blockquote id="quote-of-day-title">«{quote.quote}»</blockquote>
            {quote.note ? <p>{quote.note}</p> : null}
            <div className="quote-of-day-source">
              <div><strong>{quote.authorName}</strong><span>читатель BOOKNERD</span></div>
              <a href={quote.chapterId ? `/books/${quote.bookSlug}/chapters/${quote.chapterId}?page=${Number(quote.page || 0) + 1}` : `/books/${quote.bookSlug}`}>
                <span>{quote.bookTitle}</span>{quote.chapterTitle ? <small>{quote.chapterTitle}</small> : null}<ArrowRight size={18} />
              </a>
            </div>
          </>
        ) : (
          <div className="quote-of-day-empty" id="quote-of-day-title">
            <strong>Здесь появится мысль читателя</strong>
            <p>Выделите любимую фразу в читалке, добавьте заметку и предложите её для «Цитаты дня».</p>
          </div>
        )}
      </div>
    </section>
  );
}

function App({ initialBooks = [], initialChapters = [], initialQuoteOfDay = null }) {
  const books = initialBooks;
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState([]);
  const libraryByBook = useMemo(() => new Map(libraryItems.map((item) => [item.bookId, item])), [libraryItems]);

  useEffect(() => {
    let active = true;
    const refresh = () => loadReaderLibrary().then((items) => {
      if (active) setLibraryItems(items);
    }).catch(() => {});
    refresh();
    const onChange = (event) => {
      const item = event.detail;
      if (!item?.bookId) return;
      setLibraryItems((current) => item.status
        ? [item, ...current.filter((entry) => entry.bookId !== item.bookId)]
        : current.filter((entry) => entry.bookId !== item.bookId));
    };
    window.addEventListener('booknerd-library-change', onChange);
    return () => {
      active = false;
      window.removeEventListener('booknerd-library-change', onChange);
    };
  }, [books]);

  useEffect(() => {
    if (!searchOpen && !menuOpen) return undefined;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setSearchOpen(false);
      setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [searchOpen, menuOpen]);

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books.filter((book) => {
      const inSearch = !normalized || `${book.title} ${book.author} ${(book.genres || [book.genre]).join(' ')} ${(book.tropes || []).join(' ')}`.toLowerCase().includes(normalized);
      return inSearch;
    });
  }, [books, query]);

  const openBook = (book) => {
    if (book?.slug) window.location.href = `/books/${book.slug}`;
  };

  return (
    <>
      <div className="site-shell booknerd-home" id="top">
        <header className="home-header">
          <button type="button" className="home-menu-button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню"><Menu size={22} /></button>
          <Logo />
          <nav className="desktop-nav" aria-label="Главная навигация">
            <a href="/translations">Переводы</a>
            <a href="/library">Моя библиотека</a>
            <a href="/calendar">Календарь глав</a>
            <a href="/community">Сообщество</a>
            <a href="/about">О проекте</a>
            <a href="/team">Команда</a>
          </nav>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Открыть поиск">
              <Search size={19} />
            </button>
            <ThemeButton />
            <ProfileMenu />
          </div>
        </header>

        <main>
          <FeaturedBooks books={books} />
          <ContinueReading items={libraryItems} books={books} />
          <LatestChapters chapters={initialChapters} books={books} libraryByBook={libraryByBook} />

          <HomeShelves books={books} libraryByBook={libraryByBook} />

          {initialQuoteOfDay && <QuoteOfDay quote={initialQuoteOfDay} />}
        </main>

        <footer>
          <Logo />
          <p>Книжная команда переводов · сделано читателями для читателей</p>
          <div><a href="/translations">Переводы</a><a href="/library">Моя библиотека</a><a href="/calendar">Календарь</a><a href="/community">Сообщество</a><a href="/profile">Профиль</a><a href="/search">Поиск</a><a href="/about">О нас</a><a href="/team">Команда</a><a href="/go/telegram" target="_blank" rel="noreferrer">Telegram</a></div>
          <span>© 2026 BOOKNERD</span>
        </footer>
        <ShelfNavigation active="home" continueHref={libraryItems.some((item) => item.lastChapterId) ? '#continue-reading' : '/library'} />
      </div>

      {searchOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Поиск книг">
          <button className="overlay-close" onClick={() => setSearchOpen(false)} aria-label="Закрыть поиск"><X /></button>
          <div className="search-dialog">
            <span>Поиск по библиотеке</span>
            <div className="search-input-wrap">
              <Search size={25} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Название, автор или жанр…"
              />
            </div>
            <p>{query ? `Найдено: ${visibleBooks.length}` : 'Попробуй: романтика, Tahereh Mafi, фэнтези'}</p>
            <a className="text-button" href="/search">Поиск книг по названию, автору и жанру</a>
            {query && visibleBooks.length > 0 && (
              <div className="search-results">
                {visibleBooks.slice(0, 4).map((book) => (
                  <button key={book.id} onClick={() => { setSearchOpen(false); openBook(book); }}>
                    <span className={`result-swatch cover-${book.cover || 'garden'}`} style={book.coverUrl ? { backgroundImage: `url(${book.coverUrl})`, backgroundSize: 'cover' } : undefined} />
                    <span><strong>{book.title}</strong><small>{book.author} · {book.genre}</small></span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="mobile-drawer home-drawer" role="dialog" aria-modal="true" aria-label="Меню">
          <div className="drawer-head"><Logo /><button onClick={() => setMenuOpen(false)} aria-label="Закрыть меню"><X /></button></div>
          <nav>
            <a href="/translations" onClick={() => setMenuOpen(false)}>Переводы</a>
            <a href="/library" onClick={() => setMenuOpen(false)}>Моя библиотека</a>
            <a href="/calendar" onClick={() => setMenuOpen(false)}>Календарь глав</a>
            <a href="/community" onClick={() => setMenuOpen(false)}>Сообщество</a>
            <a href="/profile" onClick={() => setMenuOpen(false)}>Профиль</a>
            <a href="/search" onClick={() => setMenuOpen(false)}>Расширенный поиск</a>
            <a href="/about" onClick={() => setMenuOpen(false)}>О проекте</a>
            <a href="/team" onClick={() => setMenuOpen(false)}>Команда</a>
            <a href="/go/telegram" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>Telegram</a>
            <a href="/admin" onClick={() => setMenuOpen(false)}>Редакционная</a>
          </nav>
        </div>
      )}

    </>
  );
}

export default App;
