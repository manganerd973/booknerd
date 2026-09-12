'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Crown, LoaderCircle, Trophy, UserRound } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const TABS = [
  ['month', 'Этот месяц'], ['all', 'За всё время'], ['ranks', 'По рангам'], ['nominations', 'Номинации'], ['mine', 'Мои результаты'],
];

function RankRow({ reader, own = false }) {
  return (
    <a className={`ranking-reader-row rank-surface-${reader.rank.key} ${own ? 'is-own' : ''}`} href={`/readers/${reader.publicId}`}>
      <b>№{reader.position}</b>
      <span className={`reader-rank-avatar rank-frame-${reader.rank.key}`} style={{ '--rank-color': reader.rank.frameColor }}>{reader.avatarUrl ? <img src={reader.avatarUrl} alt="" /> : <UserRound />}</span>
      <span><strong>{reader.displayName}</strong><small>Уровень {reader.level} · {reader.rank.name}</small></span>
      <span><strong>{reader.monthXp || reader.totalXp} XP</strong><small>{reader.completedBooks || reader.allCompletedBooks} книг · {reader.completedChapters} глав</small></span>
      <span><small>{reader.positionChange == null ? 'позиция формируется' : reader.positionChange > 0 ? `↑ ${reader.positionChange}` : reader.positionChange < 0 ? `↓ ${Math.abs(reader.positionChange)}` : 'без изменений'}</small>{reader.latestAchievement ? <em>{reader.latestAchievement.icon} {reader.latestAchievement.name}</em> : null}</span>
    </a>
  );
}

export default function RankingsPage() {
  const [tab, setTab] = useState('month');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    const view = tab === 'all' ? 'all' : tab === 'nominations' ? 'nominations' : 'month';
    fetch(`/api/rankings?view=${view}&visitorKey=${encodeURIComponent(getVisitorKey())}`, { cache: 'no-store' })
      .then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; })
      .then((value) => { if (active) setData(value); }).catch((reason) => { if (active) setError(reason.message || 'Рейтинг временно недоступен.'); });
    return () => { active = false; };
  }, [tab]);
  const rows = useMemo(() => tab === 'ranks' && data?.rows ? [...data.rows].sort((a, b) => b.level - a.level || a.position - b.position) : data?.rows || [], [data, tab]);
  return (
    <div className="site-shell inner-site-shell ranking-page"><SiteHeader />
      <main className="ranking-main">
        <header className="ranking-hero"><span><Crown size={18} /> ЧИТАТЕЛЬСКОЕ СООБЩЕСТВО</span><h1>Мастера<br /><em>BOOKNERD</em></h1><p>Уровни отмечают прочитанные истории. Месячный рейтинг начинается заново, а постоянный опыт и награды всегда остаются с Вами.</p></header>
        <nav className="ranking-tabs" aria-label="Разделы рейтинга">{TABS.map(([key, label]) => <button type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)} aria-pressed={tab === key} key={key}>{label}</button>)}</nav>
        {error ? <section className="ranking-fallback" role="status"><Trophy /><h2>Рейтинг отдыхает</h2><p>{error} Остальные разделы BOOKNERD продолжают работать.</p></section> : null}
        {!data && !error ? <div className="ranking-loading"><LoaderCircle className="spin" /> Загружаем результаты…</div> : null}
        {data && tab === 'nominations' ? <section className="ranking-awards"><h2>Полученные номинации</h2>{data.awards?.length ? data.awards.map((award) => <article key={`${award.public_id}:${award.month_key}:${award.nomination_key}`}><Award /><span><strong>{award.title}</strong><small>{award.month_key}</small></span><a href={`/readers/${award.public_id}`}>{award.display_name || 'Читатель BOOKNERD'}</a></article>) : <p>Первые награды появятся после завершения месяца.</p>}</section> : null}
        {data && tab === 'mine' ? <section className="ranking-mine"><h2>Мои результаты</h2>{data.own ? <><RankRow reader={data.own} own /><p>Ваше место: {data.own.position}. До следующей позиции: {Math.max(0, Number(data.neighbors?.find((item) => item.position === data.own.position - 1)?.monthXp || data.own.monthXp) - data.own.monthXp)} XP.</p></> : <p>Ваш профиль пока не пересчитан или скрыт из публичной выдачи. Личная статистика остаётся в профиле.</p>}</section> : null}
        {data && !['nominations','mine'].includes(tab) ? <section className="ranking-list"><div className="ranking-list-head"><span>Место и читатель</span><span>Опыт и книги</span><span>Изменение</span></div>{rows.map((reader) => <RankRow reader={reader} own={data.own?.publicId === reader.publicId} key={reader.publicId} />)}{data.own && !rows.some((reader) => reader.publicId === data.own.publicId) ? <div className="ranking-neighbors"><h2>Ваше место и ближайшие читатели</h2>{data.neighbors.map((reader) => <RankRow reader={reader} own={data.own.publicId === reader.publicId} key={reader.publicId} />)}</div> : null}</section> : null}
      </main><SiteFooter />
    </div>
  );
}
