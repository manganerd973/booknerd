'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, GitFork, MapPinned, Save, Sparkles, WandSparkles } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import { loadReaderLibrary } from './reader-library.jsx';

const TABS = [['map', 'Карта мира'], ['tree', 'Древо персонажей'], ['timeline', 'Таймлайн'], ['quiz', 'Какой вы персонаж?']];

export default function BookUniverse({ book }) {
  const [entries, setEntries] = useState([]);
  const [active, setActive] = useState('map');
  const [answers, setAnswers] = useState([]);
  const [capsule, setCapsule] = useState({ firstImpression: '', finalImpression: '' });
  const [emotionTotals, setEmotionTotals] = useState([]);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const visitorKey = getVisitorKey();
    Promise.all([
      fetch(`/api/books/${book.id}/glossary?visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' }).then((response) => response.json()),
      fetch(`/api/reader-hub?visitorKey=${encodeURIComponent(visitorKey)}&bookId=${encodeURIComponent(book.id)}`, { cache: 'no-store' }).then((response) => response.json()),
      loadReaderLibrary(),
    ]).then(([glossary, hub, library]) => {
      setEntries(glossary.entries || []);
      const saved = (hub.capsules || []).find((item) => item.book_id === book.id);
      if (saved) setCapsule({ firstImpression: saved.first_impression || '', finalImpression: saved.final_impression || '' });
      setEmotionTotals(hub.emotionTotals || []);
      setFinished((library || []).some((item) => item.bookId === book.id && item.status === 'finished'));
    }).catch(() => {});
  }, [book.id]);

  const characters = entries.filter((entry) => entry.category === 'character');
  const places = entries.filter((entry) => entry.category === 'place');
  const timeline = entries.filter((entry) => entry.category === 'timeline');
  const quizResult = answers.length >= 3 && characters.length ? characters[answers.reduce((sum, value) => sum + value, 0) % characters.length] : null;
  const saveCapsule = async () => {
    const response = await fetch('/api/reader-hub', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visitorKey: getVisitorKey(), action: 'capsule', bookId: book.id, ...capsule }) });
    const data = await response.json().catch(() => ({}));
    setNotice(response.ok ? 'Капсула времени сохранена.' : data.error || 'Не удалось сохранить.');
  };

  if (!entries.length && !book.searchAliases?.length) return <TimeCapsule book={book} capsule={capsule} setCapsule={setCapsule} finished={finished} save={saveCapsule} notice={notice} />;
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
      <TimeCapsule book={book} capsule={capsule} setCapsule={setCapsule} finished={finished} save={saveCapsule} notice={notice} />
    </>
  );
}

function TimeCapsule({ book, capsule, setCapsule, finished, save, notice }) {
  return (
    <section className="book-time-capsule">
      <div><Clock3 size={27} /><span><small>ЛИЧНАЯ КАПСУЛА ВРЕМЕНИ</small><h2>Ожидания и итоговые эмоции</h2></span></div>
      <p>Запишите впечатление после первой главы. После завершения книги BOOKNERD покажет его рядом с итогом.</p>
      <div className="book-capsule-fields"><label><span>После первой главы</span><textarea rows="4" value={capsule.firstImpression} onChange={(event) => setCapsule({ ...capsule, firstImpression: event.target.value })} placeholder="Какой вы представляете эту историю сейчас?" /></label>{finished ? <label><span>После завершения</span><textarea rows="4" value={capsule.finalImpression} onChange={(event) => setCapsule({ ...capsule, finalImpression: event.target.value })} placeholder="Что изменилось в ваших чувствах?" /></label> : <div className="book-capsule-locked">Итоговое поле откроется после переноса книги в «Прочитано».</div>}</div>
      <button type="button" onClick={save}><Save size={16} /> Сохранить капсулу</button>{notice ? <span className="book-capsule-notice"><Check size={14} />{notice}</span> : null}
    </section>
  );
}
