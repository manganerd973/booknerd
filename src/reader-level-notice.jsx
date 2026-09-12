'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Award, BookOpen, Crown, X } from 'lucide-react';

const RANK_DIALOGUES = {
  seeker: ['Тилл: Теперь Вы — Искатель историй!', 'Иван: Кажется, первая книжная дорога уже выбрана.'],
  wanderer: ['Иван: Новый ранг — Книжный странник.', 'Тилл: Столько историй впереди. Я уже выбрал следующую.', 'Иван: Тебя никто не просил.'],
  keeper: ['Тилл: Теперь Вам доверены страницы BOOKNERD.', 'Иван: Не пугай человека ответственностью.'],
  archivist: ['Иван: Теперь Вы — Архивариус BOOKNERD.', 'Тилл: Вам доверено хранить великие истории.', 'Иван: Очень торжественно.'],
  expert: ['Тилл: Вы стали Знатоком историй!', 'Иван: Теперь спорить с Вами о книгах будет сложнее.', 'Тилл: Я всё равно попробую.'],
  master: ['Тилл: Вы стали Мастером BOOKNERD!', 'Иван: Заслуженно.', 'Тилл: Я лично следил за Вашим прогрессом.', 'Иван: С подозрительным вниманием.'],
  legend: ['Иван: Не каждый добирается так далеко.', 'Тилл: Перед нами настоящая Легенда библиотеки!', 'Иван: Я рад, что ты наконец нашёл повод для своего торжественного голоса.'],
};

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
  const dialogue = event.rankChanged ? RANK_DIALOGUES[event.rank?.key] || [] : ['Тилл: Новый уровень!', 'Иван: Можно было объявить немного спокойнее.', 'Тилл: Повышение уровня заслуживает торжественности.'];
  return <aside className={`reader-level-notice ${event.rankChanged ? 'is-rank-change' : ''}`} role="status" aria-live="polite">
    <button type="button" onClick={() => setEvent(null)} aria-label="Закрыть уведомление об уровне" ref={closeRef}><X size={17} /></button>
    <span className="reader-level-notice-icon">{event.rankChanged ? <Crown /> : <Award />}</span>
    <div><small>{event.rankChanged ? 'НОВЫЙ РАНГ' : 'НОВЫЙ УРОВЕНЬ'}</small><strong>Уровень {event.level} · {event.rank?.name}</strong>{dialogue.map((line) => <p key={line}>{line}</p>)}{event.newAchievements?.length ? <em>Открыто: {event.newAchievements.map((item) => item.name).join(' · ')}</em> : null}<a href="/profile#reader-level"><BookOpen size={15} /> Посмотреть профиль</a></div>
  </aside>;
}
