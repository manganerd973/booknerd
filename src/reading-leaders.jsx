'use client';
import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Trophy } from 'lucide-react';
export default function ReadingLeaders({ full = false }) {
  const [period, setPeriod] = useState('month');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (full && new URLSearchParams(location.search).get('period') === 'day') setPeriod('day');
  }, [full]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/reading-leaders?period=${period}&offset=${offset}${full ? '' : '&preview=1'}`, { signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error); return result; })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'Не удалось загрузить таблицу.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, offset, full, retry]);
  const rows = <div className="reading-leader-rows">{(data?.readers || []).map(reader => <div className="reading-leader-row" key={reader.publicId}>
    <span className="reading-leader-place">{reader.position}</span>
    <span className="reading-leader-initial" aria-hidden="true">{reader.name.slice(0, 1).toUpperCase()}</span>
    <span className="reading-leader-name">{reader.name}</span>
    <span className="reading-leader-score"><strong>{reader.chapters} <BookOpen size={13} aria-label="глав" /></strong><small>{reader.minutes} мин</small></span>
  </div>)}</div>;
  return <section className="reading-leaders section" aria-label="Активные читатели">
    <header><div><span className="reading-leaders-eyebrow"><Trophy size={15} /> ЧИТАЕМ ВМЕСТЕ</span><h2>Наши читатели</h2></div>
      <div className="reading-leaders-period" role="group" aria-label="Период чтения">{[['day','За день'],['month','За месяц']].map(([key,label]) => <button type="button" key={key} aria-pressed={period === key} onClick={() => { setPeriod(key); setOffset(0); setData(null); }}>{label}</button>)}</div>
    </header>
    <p className="reading-leaders-caption">Завершённые главы и время чтения · {period === 'day' ? 'сегодня' : 'текущий месяц'}</p>
    <div aria-live="polite" aria-busy={loading}>
      {loading ? <p className="reading-leaders-message">Загружаем результаты…</p> : error ? <p className="reading-leaders-message">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Повторить</button></p> : data?.readers?.length ? (full ? rows : <a className="reading-leaders-table-link" href={`/reading-leaders?period=${period}`} aria-label="Открыть полную таблицу читателей">{rows}<span className="reading-leaders-more">Все читатели <ArrowRight size={16} /></span></a>) : <p className="reading-leaders-message">Пока нет результатов за этот период. Они появятся после чтения.</p>}
    </div>
    {full && !loading && !error && <nav className="reading-leaders-pagination" aria-label="Страницы таблицы"><button disabled={!offset} onClick={() => setOffset(Math.max(0,offset-25))}>Назад</button><span>{data?.total || 0} читателей</span><button disabled={offset+25 >= (data?.total || 0)} onClick={() => setOffset(offset+25)}>Далее</button></nav>}
    <small className="reading-leaders-note">Только открытые профили. Обновление раз в 5 минут. Дни учитываются по UTC.</small>
  </section>;
}
