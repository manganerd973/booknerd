'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Award, BookOpen, Crown, UserRound } from 'lucide-react';

function ReaderAvatar({ reader, large = false }) {
  return <span className={`reader-rank-avatar rank-frame-${reader.rank.key} ${large ? 'is-large' : ''}`} style={{ '--rank-color': reader.rank.frameColor }}>{reader.avatarUrl ? <img src={reader.avatarUrl} alt="" /> : <UserRound aria-hidden="true" />}</span>;
}

function ReaderCard({ reader, nomination, master = false }) {
  return (
    <a className={`reader-master-card rank-surface-${reader.rank.key} ${master ? 'is-master' : ''}`} href={`/readers/${reader.publicId}`}>
      <ReaderAvatar reader={reader} large={master} />
      <span className="reader-master-card-copy">
        <small>{master ? <><Crown size={13} /> МАСТЕР МЕСЯЦА</> : <><Award size={13} /> {nomination}</>}</small>
        <strong>{reader.displayName}</strong>
        <em>Уровень {reader.level} · {reader.rank.name}</em>
        <span>№{reader.position} в этом месяце</span>
        <span><BookOpen size={13} /> {reader.completedBooks} книг · {reader.completedChapters} глав</span>
        <span>Любимый жанр: {reader.favoriteGenre}</span>
        {reader.latestAchievement ? <b>{reader.latestAchievement.icon} {reader.latestAchievement.name}</b> : null}
      </span>
    </a>
  );
}

export default function ReaderMasters() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/rankings?view=home', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null)
      .then((value) => { if (active) setData(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!data?.master) return null;
  return (
    <section className="reader-masters section" aria-labelledby="reader-masters-title">
      <div className="reader-masters-heading"><div><span className="section-number">МАСТЕРА BOOKNERD</span><h2 id="reader-masters-title">Читатели,<br /><em>которые живут историями</em></h2></div><a href="/ranking">Посмотреть весь рейтинг <ArrowRight size={17} /></a></div>
      <div className="reader-masters-layout">
        <ReaderCard reader={data.master} nomination="Мастер месяца" master />
        <div className="reader-master-scroll">{(data.nominations || []).map((item) => <ReaderCard reader={item.reader} nomination={item.name} key={`${item.key}:${item.reader.publicId}`} />)}</div>
      </div>
    </section>
  );
}
