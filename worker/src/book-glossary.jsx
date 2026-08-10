'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookMarked, LockKeyhole, Search } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';

export default function BookGlossary({ bookId }) {
  const [data, setData] = useState({ entries: [], total: 0, unlockedChapter: 0 });
  const [query, setQuery] = useState('');

  useEffect(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey() });
    fetch(`/api/books/${bookId}/glossary?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((value) => setData(value.entries ? value : { entries: [], total: 0, unlockedChapter: 0 }))
      .catch(() => {});
  }, [bookId]);

  const entries = useMemo(
    () => {
      const needle = query.trim().toLocaleLowerCase('ru-RU');
      if (!needle) return data.entries;
      return data.entries.filter((entry) => `${entry.name} ${entry.description}`.toLocaleLowerCase('ru-RU').includes(needle));
    },
    [data.entries, query],
  );

  if (!data.total) return null;
  return (
    <section className="book-glossary">
      <div className="book-glossary-heading">
        <BookMarked size={30} />
        <div><span className="editorial-section-number">СЛОВАРЬ КНИГИ</span><h2>Слова и их значения</h2><p>Короткие объяснения незнакомых слов. Записи со спойлерами открываются только после нужной главы.</p></div>
      </div>
      <label className="book-glossary-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти слово…" /></label>
      <div className="book-glossary-grid">
        {entries.map((entry) => <article key={entry.id}><small>СЛОВО</small><h3>{entry.name}</h3><p>{entry.description}</p></article>)}
        {query && !entries.length ? <p className="book-glossary-empty">Такого слова в словаре пока нет.</p> : null}
      </div>
      {data.total > data.entries.length ? (
        <div className="book-glossary-locked"><LockKeyhole size={18} /> Ещё {data.total - data.entries.length} записей откроются по мере чтения.</div>
      ) : null}
    </section>
  );
}
