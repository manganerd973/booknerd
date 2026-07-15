'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

function TranslationCover({ book }) {
  if (book.coverUrl) return <div className="translation-cover"><img src={book.coverUrl} alt={`Обложка книги «${book.title}»`} /></div>;
  return (
    <div className={`translation-cover cover-${book.cover || 'garden'}`}>
      <span>перевод booknerd</span><b>{book.number || 'BN'}</b><strong>{book.title}</strong><small>{book.author}</small>
    </div>
  );
}

export default function TranslationsPage({ initialBooks = [] }) {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('Все');
  const genres = useMemo(() => ['Все', ...new Set(initialBooks.flatMap((book) => book.genres || []))], [initialBooks]);
  const books = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return initialBooks.filter((book) => {
      const matchesGenre = genre === 'Все' || book.genres?.includes(genre);
      const matchesQuery = !normalized || `${book.title} ${book.author} ${(book.genres || []).join(' ')}`.toLowerCase().includes(normalized);
      return matchesGenre && matchesQuery;
    });
  }, [genre, initialBooks, query]);

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
            <label className="translations-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или автор" /></label>
          </div>
          {books.length ? (
            <div className="translations-grid">
              {books.map((book) => (
                <article className="translation-card" key={book.id}>
                  <TranslationCover book={book} />
                  <div className="translation-card-copy">
                    <span>{book.status} · {book.progress}%</span>
                    <h2>{book.title}</h2><p>{book.author}</p>
                    {book.seriesTitle ? <small className="translation-series">Серия «{book.seriesTitle}»{book.seriesNumber ? ` · книга ${book.seriesNumber}` : ''}</small> : null}
                    <small>{(book.genres || []).join(' · ')}</small>
                    <div className="translation-card-progress"><i style={{ width: `${book.progress}%` }} /></div>
                    <a href={`/books/${book.slug}`}>Открыть книгу <ArrowRight size={18} /></a>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="page-empty"><BookOpen size={38} /><h2>Ничего не нашлось</h2><p>Попробуйте другой жанр или запрос.</p></div>}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
