'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Crown, Heart, Library, LoaderCircle, UserRound } from 'lucide-react';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const SHELF_LABELS = { reading: 'Читаю', saved: 'В планах', finished: 'Прочитано', favorite: 'Любимое' };

export default function PublicReaderProfile({ publicId }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`/api/readers/${encodeURIComponent(publicId)}`, { cache: 'no-store' }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.profile; })
      .then((data) => { if (active) setProfile(data); }).catch((reason) => { if (active) setError(reason.message || 'Профиль недоступен.'); });
    return () => { active = false; };
  }, [publicId]);
  const shelves = useMemo(() => Object.entries(SHELF_LABELS).map(([key, label]) => ({ key, label, items: profile?.shelves?.filter((item) => item.status === key) || [] })), [profile]);
  return <div className="site-shell inner-site-shell public-reader-page"><SiteHeader />
    <main className="public-reader-main">
      {!profile && !error ? <div className="ranking-loading"><LoaderCircle className="spin" /> Открываем читательскую карточку…</div> : null}
      {error ? <section className="ranking-fallback"><UserRound /><h1>Профиль не открыт</h1><p>{error}</p><a href="/ranking">Вернуться к рейтингу</a></section> : null}
      {profile ? <>
        <header className={`public-reader-hero rank-surface-${profile.rank.key}`}><span className={`reader-rank-avatar is-large rank-frame-${profile.rank.key}`} style={{ '--rank-color': profile.rank.frameColor }}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <UserRound />}</span><div><small><Crown size={14} /> КАРТОЧКА ЧИТАТЕЛЯ</small><h1>{profile.displayName}</h1><p>Уровень {profile.level} · {profile.rank.name}</p><span>{profile.activity}</span></div></header>
        <section className="public-reader-stats"><article><strong>{profile.totalXp}</strong><span>общий XP</span></article><article><strong>№{profile.monthPosition}</strong><span>в этом месяце</span></article><article><strong>№{profile.allTimePosition}</strong><span>за всё время</span></article><article><strong>{profile.completedBooks}</strong><span>книг завершено</span></article><article><strong>{profile.completedChapters}</strong><span>глав прочитано</span></article></section>
        {profile.currentBook ? <section className="public-reader-current"><BookOpen /><span><small>СЕЙЧАС ЧИТАЕТ</small><a href={`/books/${profile.currentBook.slug}`}>{profile.currentBook.title}</a></span></section> : null}
        <section className="public-reader-tastes"><div><small>Любимые жанры</small><p>{profile.favoriteGenres.length ? profile.favoriteGenres.join(' · ') : 'Ещё определяются'}</p></div><div><small>Любимые тропы</small><p>{profile.favoriteTropes.length ? profile.favoriteTropes.join(' · ') : 'Ещё определяются'}</p></div></section>
        <section className="public-reader-achievements"><h2><Award /> Достижения</h2>{profile.achievements.length ? <div>{profile.achievements.map((item) => <article key={item.key}><span>{item.icon}</span><strong>{item.name}</strong><small>{item.description}</small></article>)}</div> : <p>История достижений пока пуста или скрыта.</p>}</section>
        {profile.awards.length ? <section className="public-reader-awards"><h2><Crown /> Награды</h2><div>{profile.awards.map((item) => <article key={`${item.month_key}:${item.nomination_key}`}><strong>{item.title}</strong><small>{item.month_key}</small></article>)}</div></section> : null}
        <section className="public-reader-shelves"><h2><Library /> Публичные полки</h2>{shelves.map((shelf) => shelf.items.length ? <div key={shelf.key}><h3>{shelf.label}</h3><div>{shelf.items.map((book) => <a href={`/books/${book.slug}`} key={`${shelf.key}:${book.slug}`}>{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span><Heart /></span>}<strong>{book.title}</strong></a>)}</div></div> : null)}</section>
      </> : null}
    </main><SiteFooter />
  </div>;
}
