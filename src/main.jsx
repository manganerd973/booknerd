'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  Heart,
  Menu,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { fallbackBooks } from './data.js';

function Logo() {
  return (
    <a className="logo" href="#top" aria-label="BOOKNERD — на главную">
      <span className="logo-mark" aria-hidden="true">
        <span>B</span>
        <Sparkles size={13} strokeWidth={2.5} />
      </span>
      <span className="logo-name">BOOKNERD<span>.</span></span>
    </a>
  );
}

function MiniCover({ cover, className = '' }) {
  return (
    <div className={`mini-cover cover-${cover} ${className}`} aria-hidden="true">
      <span className="cover-kicker">a booknerd translation</span>
      <span className="cover-symbol">✦</span>
      <strong>{cover === 'woven' ? 'WOVEN' : cover === 'wild' ? 'WILD' : 'STORIES'}</strong>
      <small>BOOKNERD · 2026</small>
    </div>
  );
}

function HeroArtwork() {
  return (
    <div className="hero-art" aria-label="Коллекция переводов BOOKNERD">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <span className="art-star star-one">✦</span>
      <span className="art-star star-two">✧</span>
      <div className="art-note">
        <span>выбор</span>
        <strong>читателей</strong>
        <ArrowDownRight size={24} />
      </div>
      <MiniCover cover="wild" className="cover-back" />
      <MiniCover cover="woven" className="cover-front" />
      <div className="round-stamp">
        <span>READ · FEEL · REPEAT ·</span>
        <BookOpen size={24} />
      </div>
    </div>
  );
}

function BookCover({ book }) {
  if (book.coverUrl) {
    return (
      <div className="book-cover uploaded-book-cover">
        <img src={book.coverUrl} alt={`Обложка книги «${book.title}»`} />
      </div>
    );
  }
  return (
    <div className={`book-cover cover-${book.cover}`}>
      <span className="cover-kicker">перевод booknerd</span>
      <span className="book-cover-number">{book.number || 'BN'}</span>
      <div className="book-cover-shape" />
      <div className="book-cover-copy">
        <span>{book.author}</span>
        <strong>{book.title}</strong>
        <small>BOOKNERD EDITION</small>
      </div>
    </div>
  );
}

function BookCard({ book, saved, onSave, onOpen }) {
  return (
    <article className="book-card">
      <div className="book-visual-wrap">
        <BookCover book={book} />
        <button
          className={`save-button ${saved ? 'is-saved' : ''}`}
          onClick={() => onSave(book.id)}
          aria-label={saved ? `Убрать ${book.title} из закладок` : `Сохранить ${book.title}`}
        >
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <span className="status-pill">{book.status}</span>
      </div>
      <div className="book-info">
        <div className="book-meta">
          <span>{book.genre}</span>
          <span>{book.progress}%</span>
        </div>
        <button className="book-title-button" onClick={() => onOpen(book)}>
          <h3>{book.title}</h3>
          <ArrowDownRight size={21} />
        </button>
        <p>{book.author}</p>
        <div className="progress-track" aria-label={`Готовность перевода ${book.progress}%`}>
          <span style={{ width: `${book.progress}%` }} />
        </div>
        <small className="book-note">{book.note}</small>
      </div>
    </article>
  );
}

function App({ initialBooks = [] }) {
  const books = initialBooks.length ? initialBooks : fallbackBooks;
  const filters = useMemo(() => ['Все', ...new Set(books.flatMap((book) => book.genres?.length ? book.genres : [book.genre]).filter(Boolean))], [books]);
  const [activeFilter, setActiveFilter] = useState('Все');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [saved, setSaved] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('booknerd-saved') || '[]'));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem('booknerd-saved', JSON.stringify([...saved]));
  }, [saved]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    document.body.style.overflow = selectedBook || searchOpen || menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedBook, searchOpen, menuOpen]);

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books.filter((book) => {
      const inFilter = activeFilter === 'Все' || book.genre === activeFilter;
      const inSearch = !normalized || `${book.title} ${book.author} ${book.genre}`.toLowerCase().includes(normalized);
      return inFilter && inSearch;
    });
  }, [activeFilter, query]);

  const toggleSave = (id) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setNotice('Убрано из закладок');
      } else {
        next.add(id);
        setNotice('Добавлено в закладки');
      }
      return next;
    });
  };

  const submitEmail = (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <>
      <div className="site-shell" id="top">
        <div className="announcement">
          <span>✦</span>
          <p>Истории, которые мы хотели прочитать сами</p>
          <span className="announcement-side">переводим с любовью · глава за главой</span>
        </div>

        <header className="header">
          <Logo />
          <nav className="desktop-nav" aria-label="Главная навигация">
            <a href="#catalog">Переводы</a>
            <a href="#about">О проекте</a>
            <a href="#team">Команда</a>
          </nav>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Открыть поиск">
              <Search size={19} />
            </button>
            <a className="telegram-button" href="#join">
              Наш Telegram <ArrowRight size={17} />
            </a>
            <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню">
              <Menu size={22} />
            </button>
          </div>
        </header>

        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span /> независимые книжные переводы</div>
              <h1>Истории,<br />которым нужен<br /><em>наш голос.</em></h1>
              <p className="hero-lede">
                Переводим книги бережно — сохраняя юмор, характеры и то самое чувство,
                из-за которого невозможно остановиться на одной главе.
              </p>
              <div className="hero-actions">
                <a className="primary-button" href="#catalog">
                  Смотреть переводы <ArrowDownRight size={19} />
                </a>
                  <button className="text-button" onClick={() => setSelectedBook(books[0])}>
                  Что читаем сейчас <span>↗</span>
                </button>
              </div>
              <div className="hero-stats">
                <div><strong>1 900+</strong><span>читателей</span></div>
                <div><strong>3×</strong><span>перевод · редактура · корректура</span></div>
                <div><strong>100%</strong><span>любви к деталям</span></div>
              </div>
            </div>
            <HeroArtwork />
          </section>

          <div className="ticker" aria-hidden="true">
            <div>
              <span>ROMANCE</span><b>✦</b><span>FANTASY</span><b>✦</b><span>YOUNG ADULT</span><b>✦</b>
              <span>ROMANCE</span><b>✦</b><span>FANTASY</span><b>✦</b><span>YOUNG ADULT</span><b>✦</b>
            </div>
          </div>

          <section className="catalog section" id="catalog">
            <div className="section-heading catalog-heading">
              <div>
                <span className="section-number">01 / БИБЛИОТЕКА</span>
                <h2>Выбирай следующую<br /><em>книжную любовь</em></h2>
              </div>
              <p>От уютной романтики до миров, где магия требует слишком высокую цену.</p>
            </div>

            <div className="catalog-toolbar">
              <div className="filter-list" role="group" aria-label="Фильтр по жанрам">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    className={activeFilter === filter ? 'active' : ''}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <button className="catalog-search" onClick={() => setSearchOpen(true)}>
                <Search size={18} /> Найти книгу
              </button>
            </div>

            {visibleBooks.length > 0 ? (
              <div className="book-grid">
                {visibleBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    saved={saved.has(book.id)}
                    onSave={toggleSave}
                    onOpen={setSelectedBook}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen size={30} />
                <h3>Ничего не нашлось</h3>
                <p>Попробуй другой запрос или жанр.</p>
              </div>
            )}
          </section>

          <section className="manifesto section" id="about">
            <div className="manifesto-card">
              <div className="manifesto-topline">
                <span>02 / НАШ ПОДХОД</span>
                <Sparkles size={28} />
              </div>
              <blockquote>
                Мы переводим не только слова.<br />Мы переводим <em>ощущение.</em>
              </blockquote>
              <div className="manifesto-bottom">
                <p>
                  Сохраняем голос автора, спорим о каждой интонации и не выпускаем главу,
                  пока она не зазвучит по‑настоящему.
                </p>
                <a href="#team">Познакомиться с командой <ArrowRight size={18} /></a>
              </div>
            </div>

            <div className="values" id="team">
              <article>
                <span>01</span>
                <Heart size={24} />
                <h3>С любовью к тексту</h3>
                <p>Не упрощаем характеры и не теряем атмосферу ради скорости.</p>
              </article>
              <article>
                <span>02</span>
                <MessageCircle size={24} />
                <h3>Вместе с читателями</h3>
                <p>Обсуждаем, слушаем обратную связь и выбираем истории вместе.</p>
              </article>
              <article>
                <span>03</span>
                <Star size={24} />
                <h3>Качество — привычка</h3>
                <p>Перевод, редактура и корректура проходят несколько внимательных этапов.</p>
              </article>
            </div>
          </section>

          <section className="join section" id="join">
            <div className="join-decoration" aria-hidden="true">
              <span>BOOK</span><span>NERD</span>
            </div>
            <div className="join-content">
              <span className="section-number">03 / ОСТАВАЙСЯ С НАМИ</span>
              <h2>Новая глава уже<br /><em>на подходе.</em></h2>
              <p>Получай уведомления о новых главах, переводах и книжных голосованиях.</p>
              {subscribed ? (
                <div className="success-message"><Check size={19} /> Ты в книжном списке!</div>
              ) : (
                <form className="join-form" onSubmit={submitEmail}>
                  <label className="sr-only" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Твой email"
                  />
                  <button type="submit" aria-label="Подписаться"><Send size={19} /></button>
                </form>
              )}
              <small>Только важное. Никакого спама — мы заняты книгами.</small>
            </div>
          </section>
        </main>

        <footer>
          <Logo />
          <p>Книжная команда переводов · сделано читателями для читателей</p>
          <div><a href="#catalog">Переводы</a><a href="#about">О нас</a><a href="#join">Связаться</a></div>
          <span>© 2026 BOOKNERD</span>
        </footer>
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
            {query && visibleBooks.length > 0 && (
              <div className="search-results">
                {visibleBooks.slice(0, 4).map((book) => (
                  <button key={book.id} onClick={() => { setSelectedBook(book); setSearchOpen(false); }}>
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
        <div className="mobile-drawer">
          <div className="drawer-head"><Logo /><button onClick={() => setMenuOpen(false)}><X /></button></div>
          <nav>
            <a href="#catalog" onClick={() => setMenuOpen(false)}><span>01</span>Переводы</a>
            <a href="#about" onClick={() => setMenuOpen(false)}><span>02</span>О проекте</a>
            <a href="#team" onClick={() => setMenuOpen(false)}><span>03</span>Команда</a>
            <a href="#join" onClick={() => setMenuOpen(false)}><span>04</span>Присоединиться</a>
          </nav>
          <p>Истории, которые мы хотели прочитать сами.</p>
        </div>
      )}

      {selectedBook && (
        <div className="overlay book-overlay" role="dialog" aria-modal="true" aria-label={`О книге ${selectedBook.title}`}>
          <button className="overlay-close" onClick={() => setSelectedBook(null)} aria-label="Закрыть"><X /></button>
          <div className="book-dialog">
            <BookCover book={selectedBook} />
            <div className="book-dialog-copy">
              <span className="dialog-status">{selectedBook.status}</span>
              <small>{selectedBook.genre} {selectedBook.note ? `· ${selectedBook.note}` : ''}</small>
              <h2>{selectedBook.title}</h2>
              <p className="dialog-author">{selectedBook.author}</p>
              <p>{selectedBook.synopsis || 'Следим за интонациями, бережём атмосферу и обсуждаем каждую важную деталь внутри команды.'}</p>
              <div className="dialog-progress">
                <div><span>Готовность перевода</span><strong>{selectedBook.progress}%</strong></div>
                <div className="progress-track"><span style={{ width: `${selectedBook.progress}%` }} /></div>
              </div>
              <div className="dialog-actions">
                {selectedBook.slug && <a className="primary-button" href={`/books/${selectedBook.slug}`}>Открыть книгу <ArrowRight size={18} /></a>}
                <button className="dialog-save-button" onClick={() => toggleSave(selectedBook.id)}>
                  <Bookmark size={18} fill={saved.has(selectedBook.id) ? 'currentColor' : 'none'} />
                  {saved.has(selectedBook.id) ? 'Сохранено' : 'В закладки'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="toast"><Check size={17} />{notice}</div>}
    </>
  );
}

export default App;
