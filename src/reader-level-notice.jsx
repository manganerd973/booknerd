'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Award, BookOpen, Crown, X } from 'lucide-react';

export default function ReaderLevelNotice() {
  const [event, setEvent] = useState(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const show = (message) => setEvent(message.detail || null);
    window.addEventListener('booknerd:level-up', show);
    return () => window.removeEventListener('booknerd:level-up', show);
  }, []);
  useEffect(() => { if (event) closeRef.current?.focus(); }, [event]);
  if (!event) return null;
  const achievementOnly = !event.levelChanged && event.newAchievements?.length;
  const message = achievementOnly
    ? 'Достижение добавлено в Вашу читательскую коллекцию.'
    : event.rankChanged
      ? `Открыт новый книжный ранг «${event.rank?.name || 'BOOKNERD'}».`
      : 'Ваш читательский уровень повысился.';
  return <aside className={`reader-level-notice ${event.rankChanged ? 'is-rank-change' : ''}`} role="status" aria-live="polite">
    <button type="button" onClick={() => setEvent(null)} aria-label="Закрыть уведомление об уровне" ref={closeRef}><X size={17} /></button>
    <span className="reader-level-notice-icon">{event.rankChanged ? <Crown /> : <Award />}</span>
    <div><small>{achievementOnly ? 'НОВОЕ ДОСТИЖЕНИЕ' : event.rankChanged ? 'НОВЫЙ РАНГ' : 'НОВЫЙ УРОВЕНЬ'}</small><strong>{achievementOnly ? event.newAchievements.map((item) => item.name).join(' · ') : `Уровень ${event.level} · ${event.rank?.name}`}</strong><p>{message}</p>{!achievementOnly && event.newAchievements?.length ? <em>Открыто: {event.newAchievements.map((item) => item.name).join(' · ')}</em> : null}<a href="/profile#reader-level"><BookOpen size={15} /> Посмотреть профиль</a></div>
  </aside>;
}
