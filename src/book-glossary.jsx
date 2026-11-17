'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookMarked, LockKeyhole, Search } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';

export default function BookGlossary({ bookId, embedded = false }) {
  const [data, setData] = useState({ entries: [], total: 0, unlockedChapter: 0 });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ visitorKey: getVisitorKey() });
    fetch(`/api/books/${bookId}/glossary?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('Не удалось загрузить словарь.'); return response.json(); })
      .then((value) => setData(value.entries ? value : { entries: [], total: 0, unlockedChapter: 0 }))
      .catch((error) => { if (error.name !== 'AbortError') setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bookId, retry]);

  const entries = useMemo(
    () => {
      const needle = query.trim().toLocaleLowerCase('ru-RU');
      if (!needle) return data.entries;
      return data.entries.filter((entry) => `${entry.name} ${entry.description}`.toLocaleLowerCase('ru-RU').includes(needle));
    },
    [data.entries, query],
  );

  if (!data.total && !embedded && !loading && !error) return null;
  return (
    <section className={embedded ? "book-glossary reader-book-glossary" : "book-glossary"}>
      <div className="book-glossary-heading">
        <BookMarked size={30} />
        <div><span className="editorial-section-number">СЛОВАРЬ КНИГИ</span><h2>Слова и их значения</h2><p>Короткие объяснения незнакомых слов. Записи со спойлерами открываются только после нужной главы.</p></div>
      </div>
      <label className="book-glossary-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти слово…" /></label>
      <div className="book-glossary-grid">
        {loading ? <p role="status">Загружаем словарь…</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(retry + 1)}>Повторить</button></p> : !data.total ? <p>В словаре пока нет записей.</p> : null}
        {entries.map((entry) => <article key={entry.id}><small>СЛОВО</small><h3>{entry.name}</h3><p>{entry.description}</p></article>)}
        {query && !entries.length ? <p className="book-glossary-empty">Такого слова в словаре пока нет.</p> : null}
      </div>
      {data.total > data.entries.length ? (
        <div className="book-glossary-locked"><LockKeyhole size={18} /> Ещё {data.total - data.entries.length} записей откроются по мере чтения.</div>
      ) : null}
    </section>
  );
}
