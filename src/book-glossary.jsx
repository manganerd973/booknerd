'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookMarked, LockKeyhole, MapPinned, Sparkles, UserRound } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';

const CATEGORY = {
  character: { label: 'Персонажи', icon: UserRound },
  place: { label: 'Страны и места', icon: MapPinned },
  term: { label: 'Термины мира', icon: Sparkles },
};

export default function BookGlossary({ bookId }) {
  const [data, setData] = useState({ entries: [], total: 0, unlockedChapter: 0 });
  const [active, setActive] = useState('all');

  useEffect(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey() });
    fetch(`/api/books/${bookId}/glossary?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((value) => setData(value.entries ? value : { entries: [], total: 0, unlockedChapter: 0 }))
      .catch(() => {});
  }, [bookId]);

  const entries = useMemo(
    () => active === 'all' ? data.entries : data.entries.filter((entry) => entry.category === active),
    [active, data.entries],
  );

  if (!data.total) return null;
  return (
    <section className="book-glossary">
      <div className="book-glossary-heading">
        <BookMarked size={30} />
        <div><span className="editorial-section-number">СЛОВАРЬ МИРА</span><h2>Без спойлеров</h2><p>Новые сведения открываются только после нужной главы.</p></div>
      </div>
      <div className="book-glossary-tabs">
        <button className={active === 'all' ? 'is-active' : ''} type="button" onClick={() => setActive('all')}>Все</button>
        {Object.entries(CATEGORY).map(([key, category]) => (
          <button className={active === key ? 'is-active' : ''} type="button" onClick={() => setActive(key)} key={key}>{category.label}</button>
        ))}
      </div>
      <div className="book-glossary-grid">
        {entries.map((entry) => {
          const Icon = CATEGORY[entry.category]?.icon || Sparkles;
          return (
            <article key={entry.id}>
              <Icon size={21} />
              <div><small>{CATEGORY[entry.category]?.label}</small><h3>{entry.name}</h3>{entry.pronunciation ? <em>Произношение: {entry.pronunciation}</em> : null}</div>
              <p>{entry.description}</p>
              {entry.connections ? <span><strong>Связи:</strong> {entry.connections}</span> : null}
            </article>
          );
        })}
      </div>
      {data.total > data.entries.length ? (
        <div className="book-glossary-locked"><LockKeyhole size={18} /> Ещё {data.total - data.entries.length} записей откроются по мере чтения.</div>
      ) : null}
    </section>
  );
}
