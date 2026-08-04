'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

export default function AdvancedSearchPage({ books = [] }) {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [length, setLength] = useState('all');
  const [chapters, setChapters] = useState('all');
  const genres = [...new Set(books.flatMap((book) => book.genres || []).filter(Boolean))].sort();
  const countries = [...new Set(books.map((book) => book.country).filter(Boolean))].sort();
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru-RU');
    return books.filter((book) => {
      const haystack = [book.title, book.originalTitle, book.author, book.country, book.translator, book.editor, book.proofreader, ...(book.genres || []), ...(book.tropes || []), ...(book.searchAliases || []), book.quoteOfDay].join(' ').toLocaleLowerCase('ru-RU');
      if (needle && !haystack.includes(needle)) return false;
      if (genre && !(book.genres || []).includes(genre)) return false;
      if (country && book.country !== country) return false;
      if (year && Number(book.publicationYear || 0) !== Number(year)) return false;
      const pages = Number(book.pageCount || 0);
      if (length === 'short' && (!pages || pages > 300)) return false;
      if (length === 'medium' && (pages < 301 || pages > 500)) return false;
      if (length === 'long' && pages < 501) return false;
      const count = Number(book.publishedChapterCount || 0);
      if (chapters === 'short' && count > 20) return false;
      if (chapters === 'medium' && (count < 21 || count > 50)) return false;
      if (chapters === 'long' && count < 51) return false;
      return true;
    });
  }, [books, chapters, country, genre, length, query, year]);

  return (
    <div className="site-shell inner-site-shell advanced-search-page">
      <SiteHeader active="search" />
      <main>
        <section className="inner-hero"><span className="section-number">РАСШИРЕННЫЙ ПОИСК</span><div><h1>Найдите историю<br /><em>по любой детали.</em></h1><p>Название, автор, персонаж, мир, троп, цитата, страна, переводчик, год, длина или количество глав.</p></div></section>
        <section className="advanced-search-content">
          <div className="advanced-search-query"><Search size={24} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, автор, персонаж, мир, троп, цитата…" autoFocus /><span>{results.length}</span></div>
          <div className="advanced-search-filters"><SlidersHorizontal size={20} /><label><span>Жанр</span><select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">Все</option>{genres.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Страна</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Все</option>{countries.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Год</span><input type="number" value={year} onChange={(event) => setYear(event.target.value)} placeholder="2024" /></label><label><span>Длина</span><select value={length} onChange={(event) => setLength(event.target.value)}><option value="all">Любая</option><option value="short">До 300 стр.</option><option value="medium">301–500 стр.</option><option value="long">Больше 500 стр.</option></select></label><label><span>Глав</span><select value={chapters} onChange={(event) => setChapters(event.target.value)}><option value="all">Любое число</option><option value="short">До 20</option><option value="medium">21–50</option><option value="long">51+</option></select></label></div>
          <div className="advanced-search-results">{results.map((book) => <article key={book.id}><a className="advanced-search-cover" href={`/books/${book.slug}`}>{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>B</span>}</a><div><small>{[book.country, book.publicationYear, `${book.publishedChapterCount || 0} глав`].filter(Boolean).join(' · ')}</small><h2><a href={`/books/${book.slug}`}>{book.title}</a></h2><p>{book.author}</p><div>{(book.tropes || []).slice(0, 3).map((trope) => <span key={trope}>{trope}</span>)}</div><em>{[book.translator && `Перевод: ${book.translator}`, book.editor && `Редактура: ${book.editor}`].filter(Boolean).join(' · ')}</em></div><a href={`/books/${book.slug}`} aria-label={`Открыть ${book.title}`}><ArrowRight size={19} /></a></article>)}</div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
