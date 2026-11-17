'use client';

import React, { useEffect, useState } from 'react';
import { Clock3, GitFork, MapPinned, Sparkles, WandSparkles } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';

const TABS = [['map', 'Карта мира'], ['tree', 'Древо персонажей'], ['timeline', 'Таймлайн'], ['quiz', 'Какой вы персонаж?']];

export default function BookUniverse({ book }) {
  const [entries, setEntries] = useState([]);
  const [active, setActive] = useState('map');
  const [answers, setAnswers] = useState([]);
  const [emotionTotals, setEmotionTotals] = useState([]);

  useEffect(() => {
    const visitorKey = getVisitorKey();
    Promise.all([
      fetch(`/api/books/${book.id}/glossary?visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' }).then((response) => response.json()),
      fetch(`/api/reader-hub?visitorKey=${encodeURIComponent(visitorKey)}&bookId=${encodeURIComponent(book.id)}`, { cache: 'no-store' }).then((response) => response.json()),
    ]).then(([glossary, hub]) => {
      setEntries(glossary.entries || []);
      setEmotionTotals(hub.emotionTotals || []);
    }).catch(() => {});
  }, [book.id]);

  const characters = entries.filter((entry) => entry.category === 'character');
  const places = entries.filter((entry) => entry.category === 'place');
  const timeline = entries.filter((entry) => entry.category === 'timeline');
  const quizResult = answers.length >= 3 && characters.length ? characters[answers.reduce((sum, value) => sum + value, 0) % characters.length] : null;

  if (!entries.length && !book.searchAliases?.length) return null;
  return (
    <>
      <section className="book-universe">
        <div className="book-universe-heading"><Sparkles size={29} /><div><span className="editorial-section-number">МИР КНИГИ</span><h2>Открывается вместе с чтением</h2><p>Только уже знакомые вам места, связи и события — без будущих спойлеров.</p></div></div>
        <div className="book-universe-tabs">{TABS.map(([value, label]) => <button className={active === value ? 'is-active' : ''} type="button" onClick={() => setActive(value)} key={value}>{label}</button>)}</div>
        {active === 'map' ? <div className="book-world-map">{places.length ? places.map((entry, index) => <article style={{ '--map-x': `${16 + (index * 29) % 70}%`, '--map-y': `${18 + (index * 37) % 62}%` }} key={entry.id}><MapPinned size={19} /><span><strong>{entry.name}</strong><small>{entry.description}</small></span></article>) : <p>Локации появятся после добавления мест в словарь книги.</p>}</div> : null}
        {active === 'tree' ? <div className="book-character-tree">{characters.length ? characters.map((entry) => <article key={entry.id}><GitFork size={18} /><div><strong>{entry.name}</strong><p>{entry.description}</p>{entry.connections ? <small>Связи: {entry.connections}</small> : null}</div></article>) : <p>Связи персонажей появятся по мере чтения.</p>}</div> : null}
        {active === 'timeline' ? <div className="book-timeline">{timeline.length ? timeline.map((entry, index) => <article key={entry.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{entry.name}</strong><p>{entry.description}</p></div></article>) : <p><Clock3 size={20} /> Хронология заполнится, когда команда добавит события в словарь.</p>}</div> : null}
        {active === 'quiz' ? <div className="book-character-quiz">
          {characters.length < 2 ? <p>Тест появится, когда в словаре откроются как минимум два персонажа.</p> : quizResult ? <article><WandSparkles size={26} /><small>ВАМ БЛИЖЕ ВСЕГО</small><h3>{quizResult.name}</h3><p>{quizResult.description}</p><button type="button" onClick={() => setAnswers([])}>Пройти ещё раз</button></article> : <div><h3>{['Как вы действуете в сложной ситуации?', 'Что для вас важнее всего?', 'Какую роль вы выбираете в команде?'][answers.length]}</h3>{['Думаю и наблюдаю', 'Действую сразу', 'Сначала защищаю близких'].map((answer, index) => <button type="button" onClick={() => setAnswers([...answers, index])} key={answer}>{answer}</button>)}</div>}
        </div> : null}
        {emotionTotals.length ? <div className="book-emotion-map"><small>ЛЕНТА ЭМОЦИЙ ЧИТАТЕЛЕЙ</small><div>{(book.chapters || []).map((chapter) => {
          const chapterEmotions = emotionTotals.filter((item) => item.chapter_id === chapter.id);
          if (!chapterEmotions.length) return null;
          return <article key={chapter.id}><strong>{chapter.title || 'Новая глава'}</strong><span>{chapterEmotions.map((item) => <i key={item.emoji}>{item.emoji} {item.total}</i>)}</span></article>;
        })}</div></div> : null}
      </section>
    </>
  );
}
