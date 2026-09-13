'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Crown, LoaderCircle, Sparkles, Trophy, UserRound } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const TABS = [
  ['month', 'Этот месяц'], ['all', 'За всё время'], ['ranks', 'По рангам'], ['nominations', 'Номинации'], ['mine', 'Мои результаты'],
];

function countLabel(value, forms) {
  const count = Math.max(0, Number(value || 0));
  const mod100 = count % 100;
  const mod10 = count % 10;
  const form = mod100 >= 11 && mod100 <= 19 ? forms[2] : mod10 === 1 ? forms[0] : mod10 >= 2 && mod10 <= 4 ? forms[1] : forms[2];
  return `${count.toLocaleString('ru-RU')} ${form}`;
}

function RankRow({ reader, own = false, scope = 'month' }) {
  const experience = scope === 'all' ? reader.totalXp : reader.monthXp;
  const completedBooks = scope === 'all' ? reader.allCompletedBooks : reader.completedBooks;
  const positionLabel = reader.positionChange == null
    ? 'Позиция формируется'
    : reader.positionChange > 0
      ? `Подъём на ${reader.positionChange}`
      : reader.positionChange < 0
        ? `Изменение на ${Math.abs(reader.positionChange)}`
        : 'Позиция без изменений';
  return (
    <a
      className={`ranking-reader-row rank-surface-${reader.rank.key} ${reader.position <= 3 ? `is-podium is-place-${reader.position}` : ''} ${own ? 'is-own' : ''}`}
      href={`/readers/${reader.publicId}`}
      aria-label={`${reader.displayName}, место ${reader.position}, уровень ${reader.level}`}
    >
      <span className="ranking-reader-position"><small>место</small><b>№{reader.position}</b></span>
      <span className={`reader-rank-avatar rank-frame-${reader.rank.key}`} style={{ '--rank-color': reader.rank.frameColor }}>{reader.avatarUrl ? <img src={reader.avatarUrl} alt="" /> : <UserRound />}</span>
      <span className="ranking-reader-identity"><strong>{reader.displayName}</strong><small>Уровень {reader.level} · {reader.rank.name}</small></span>
      <span className="ranking-reader-score"><strong>{Number(experience || 0).toLocaleString('ru-RU')} <em>XP</em></strong><small><BookOpen size={13} aria-hidden="true" /> {countLabel(completedBooks, ['книга', 'книги', 'книг'])} · {countLabel(reader.completedChapters, ['глава', 'главы', 'глав'])}</small></span>
      <span className="ranking-reader-status"><small>{positionLabel}</small>{reader.latestAchievement ? <em>{reader.latestAchievement.icon} {reader.latestAchievement.name}</em> : <em className="is-muted">Новое достижение впереди</em>}</span>
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
    <div className="site-shell inner-site-shell ranking-page"><SiteHeader active="ranking" />
      <main className="ranking-main">
        <header className="ranking-hero">
          <span><Crown size={18} /> ЧИТАТЕЛЬСКОЕ СООБЩЕСТВО</span>
          <h1><span>Мастера</span><em>BOOKNERD</em></h1>
          <div className="ranking-hero-copy"><Sparkles size={20} aria-hidden="true" /><p>Уровни отмечают прочитанные истории. Месячный рейтинг начинается заново, а постоянный опыт и награды всегда остаются с Вами.</p></div>
        </header>
        <nav className="ranking-tabs" aria-label="Разделы рейтинга">{TABS.map(([key, label]) => <button type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)} aria-pressed={tab === key} key={key}>{label}</button>)}</nav>
        {error ? <section className="ranking-fallback" role="status"><Trophy /><h2>Рейтинг отдыхает</h2><p>{error} Остальные разделы BOOKNERD продолжают работать.</p></section> : null}
        {!data && !error ? <div className="ranking-loading"><LoaderCircle className="spin" /> Загружаем результаты…</div> : null}
        {data && tab === 'nominations' ? <section className="ranking-awards"><h2>Полученные номинации</h2>{data.awards?.length ? data.awards.map((award) => <article key={`${award.public_id}:${award.month_key}:${award.nomination_key}`}><Award /><span><strong>{award.title}</strong><small>{award.month_key}</small></span><a href={`/readers/${award.public_id}`}>{award.display_name || 'Читатель BOOKNERD'}</a></article>) : <p>Первые награды появятся после завершения месяца.</p>}</section> : null}
        {data && tab === 'mine' ? <section className="ranking-mine"><h2>Мои результаты</h2>{data.own ? <><RankRow reader={data.own} own /><p>Ваше место: {data.own.position}. До следующей позиции: {data.own.position <= 1 ? 0 : Math.max(1, Number(data.neighbors?.find((item) => item.position === data.own.position - 1)?.monthXp ?? data.own.monthXp) - data.own.monthXp + 1)} XP.</p></> : <p>Ваш профиль пока не пересчитан или скрыт из публичной выдачи. Личная статистика остаётся в профиле.</p>}</section> : null}
        {data && tab === 'ranks' ? <section className="ranking-rank-groups">{[...(data.ranks || [])].reverse().map((rank) => { const members = rows.filter((reader) => reader.rank.key === rank.key); return members.length ? <section key={rank.key}><h2>{rank.icon} {rank.name}</h2>{members.map((reader) => <RankRow reader={reader} own={data.own?.publicId === reader.publicId} key={reader.publicId} />)}</section> : null; })}</section> : null}
        {data && ['month','all'].includes(tab) ? <section className="ranking-list"><div className="ranking-list-head"><span>Место и читатель</span><span>Опыт и книги</span><span>Изменение</span></div>{rows.map((reader) => <RankRow reader={reader} scope={tab} own={data.own?.publicId === reader.publicId} key={reader.publicId} />)}{data.own && !rows.some((reader) => reader.publicId === data.own.publicId) ? <div className="ranking-neighbors"><h2>Ваше место и ближайшие читатели</h2>{data.neighbors.map((reader) => <RankRow reader={reader} scope={tab} own={data.own.publicId === reader.publicId} key={reader.publicId} />)}</div> : null}</section> : null}
      </main><SiteFooter />
    </div>
  );
}
