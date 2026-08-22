'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Gift, Heart, Network, Quote, RefreshCw, Sparkles } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';

const SHELF_KEY = 'booknerd:custom-shelves:v27';
const REREAD_KEY = 'booknerd:reread:v27';

function level(value, labels) {
  const index = Math.max(0, Math.min(labels.length - 1, Number(value || 0)));
  return labels[index];
}

function inferredProfile(book) {
  const haystack = `${(book.genres || []).join(' ')} ${(book.tropes || []).join(' ')} ${(book.triggerWarnings || []).join(' ')}`.toLocaleLowerCase('ru-RU');
  const romance = /роман|любов|romance|враги|friends to lovers/.test(haystack) ? 3 : 1;
  const angst = /драма|утрат|смерт|травм|войн|насили|стекл/.test(haystack) ? 3 : 1;
  const triggers = (book.triggerWarnings || []).length > 4 ? 3 : (book.triggerWarnings || []).length ? 2 : 0;
  return {
    romance: level(romance, ['Отсутствует', 'Низкий', 'Умеренный', 'Высокий', 'Основная линия']),
    angst: level(angst, ['Минимальная', 'Низкая', 'Умеренная', 'Высокая', 'Очень высокая']),
    pace: /триллер|детектив|экшен|приключ/.test(haystack) ? 'Быстрый' : 'Размеренный',
    spice: book.hasHotScenes ? 'Высокая' : 'Низкая',
    triggers: level(triggers, ['Лёгкая', 'Умеренная', 'Заметная', 'Высокая']),
    atmosphere: [...(book.genres || []), ...(book.tropes || [])].slice(0, 5),
    age: book.hasHotScenes || triggers >= 3 ? '18+' : triggers >= 2 ? '16+' : '12+',
  };
}

export function BookSuitability({ book }) {
  const profile = useMemo(() => inferredProfile(book), [book]);
  const [endingOpen, setEndingOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const reasons = [book.hasHotScenes ? 'наличие откровенных сцен' : '', ...(book.triggerWarnings || []).slice(0, 2)].filter(Boolean);
  const ageExplanation = reasons.length ? `Причина: ${reasons.join('; ')}.` : 'Ограничение установлено с учётом содержания книги.';
  return <section className="book-quick-guide">
    <div className="book-quick-guide-top">
      <button type="button" className="book-quick-fit" onClick={() => setDetailsOpen((value) => !value)} aria-expanded={detailsOpen}><span>Подойдёт ли мне эта книга?</span><strong>{detailsOpen ? 'Скрыть' : 'Посмотреть'}</strong></button>
      <span className="book-quick-age" title={ageExplanation}><small>Возрастное ограничение</small><strong>{profile.age}</strong></span>
      <button type="button" className="book-quick-ending" onClick={() => setEndingOpen((value) => !value)}><span>Финал</span><strong>{endingOpen ? (book.status === 'Завершено' ? 'Открыт' : 'Книга выходит') : 'Спойлер'}</strong></button>
    </div>
    {profile.atmosphere.length ? <p className="book-quick-atmosphere"><small>Атмосфера:</small> {profile.atmosphere.map((item) => <span key={item}>{item}</span>)}</p> : null}
    {detailsOpen ? <div className="book-quick-details">{[['Уровень романтики', profile.romance], ['Эмоциональная тяжесть', profile.angst], ['Темп повествования', profile.pace], ['Степень откровенности', profile.spice], ['Тяжесть триггеров', profile.triggers]].map(([name, value]) => <span key={name}><small>{name}</small><strong>{value}</strong></span>)}<p className="book-age-explanation"><strong>Возрастное ограничение: {profile.age}.</strong> {ageExplanation}</p></div> : null}
  </section>;
}

export function RelationshipMap({ book, chapters }) {
  const [reread, setReread] = useState(false);
  useEffect(() => { try { setReread(localStorage.getItem(`${REREAD_KEY}:${book.id}`) === '1'); } catch {} }, [book.id]);
  const names = useMemo(() => {
    const source = [...(book.tropes || []), ...(book.genres || [])].slice(0, 4);
    return source.length ? source : ['Главные герои', 'Семья', 'Союзники'];
  }, [book]);
  const toggle = () => { const next = !reread; setReread(next); try { localStorage.setItem(`${REREAD_KEY}:${book.id}`, next ? '1' : '0'); } catch {} };
  return <section className="relationship-card"><header><div><span>БЕЗ СПОЙЛЕРОВ</span><h2>Карта отношений</h2></div><button type="button" onClick={toggle}><RefreshCw size={15} /> {reread ? 'Все связи открыты' : 'Режим перечитывания'}</button></header><div className="relationship-map"><article><Network size={22} /><strong>{book.title}</strong></article>{names.map((name, index) => <article className={!reread && index > 1 ? 'is-locked' : ''} key={name}><small>{!reread && index > 1 ? `Откроется после главы ${Math.min(chapters.length || 3, index + 1)}` : index === 0 ? 'Любовная линия' : index === 1 ? 'Союзники' : 'Спойлерная связь'}</small><strong>{!reread && index > 1 ? 'Скрыто' : name}</strong></article>)}</div></section>;
}

export function QuoteGallery({ book }) {
  const quotes = [book.quoteOfDay, book.dedication].filter(Boolean).slice(0, 6);
  const [notice, setNotice] = useState('');
  if (!quotes.length) return null;
  const copy = async (quote) => { await navigator.clipboard?.writeText(`«${quote}»\n${book.title} — BOOKNERD\n${location.href}`); setNotice('Цитата и ссылка скопированы'); setTimeout(() => setNotice(''), 1800); };
  return <section className="quote-gallery"><header><span>СОХРАНИТЬ И ПОДЕЛИТЬСЯ</span><h2>Галерея цитат</h2></header><div>{quotes.map((quote, index) => <article key={index}><Quote size={21} /><blockquote>«{quote}»</blockquote><button type="button" onClick={() => copy(quote)}><Copy size={15} /> Скопировать карточку</button></article>)}</div>{notice ? <p role="status"><Check size={14} /> {notice}</p> : null}</section>;
}

export function CustomShelves({ book }) {
  const presets = ['Любимые стеклянные книги', 'Перечитать зимой', 'Горячие мужчины с проблемами', 'Книги, которые меня уничтожили'];
  const [shelves, setShelves] = useState([]);
  const [draft, setDraft] = useState('');
  useEffect(() => { try { const all = JSON.parse(localStorage.getItem(SHELF_KEY) || '{}'); setShelves(all[book.id] || []); } catch {} }, [book.id]);
  const save = (next) => { setShelves(next); try { const all = JSON.parse(localStorage.getItem(SHELF_KEY) || '{}'); all[book.id] = next; localStorage.setItem(SHELF_KEY, JSON.stringify(all)); } catch {} };
  const add = (name) => { const clean = String(name || '').trim().slice(0, 60); if (clean && !shelves.includes(clean)) save([...shelves, clean]); setDraft(''); };
  return <section className="custom-shelves"><header><Gift size={22} /><div><small>СВОИ КОЛЛЕКЦИИ</small><h2>Добавить на особую полку</h2></div></header><div className="custom-shelf-presets">{presets.map((name) => <button type="button" className={shelves.includes(name) ? 'is-active' : ''} onClick={() => shelves.includes(name) ? save(shelves.filter((item) => item !== name)) : add(name)} key={name}><Heart size={14} /> {name}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); add(draft); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Название своей полки" /><button type="submit">Создать</button></form></section>;
}

export function ReaderAchievements({ book }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const visitor = getVisitorKey();
    const hour = new Date().getHours();
    const achievements = [{ icon: '📖', title: 'Первая открытая книга', unlocked: true }, { icon: '🌙', title: 'Прочитано ночью', unlocked: hour < 6 || hour >= 23 }, { icon: '💬', title: 'Оставлен первый отзыв', unlocked: false }, { icon: '✨', title: 'Собрано 10 любимых цитат', unlocked: false }, { icon: '🌿', title: 'С BOOKNERD уже год', unlocked: visitor.length > 8 && false }];
    setItems(achievements);
  }, [book.id]);
  return <section className="reader-achievements"><header><Sparkles size={21} /><div><small>БЕЗ СОРЕВНОВАНИЯ</small><h2>Личные достижения</h2></div></header><div>{items.map((item) => <article className={item.unlocked ? 'is-unlocked' : ''} key={item.title}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.unlocked ? 'Получено' : 'Откроется само'}</small></article>)}</div></section>;
}
