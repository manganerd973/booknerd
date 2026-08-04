'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CakeSlice, CalendarHeart, Dice5, Flame, MessageCircle, Sparkles, TrendingUp } from 'lucide-react';

function dateSeed() {
  const today = new Date();
  return Number(`${today.getFullYear()}${today.getMonth() + 1}${today.getDate()}`);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function dayPart() {
  const hour = new Date().getHours();
  if (hour < 12) return { offset: 3, label: 'Рекомендация для тихого утра' };
  if (hour < 18) return { offset: 7, label: 'История для дневного перерыва' };
  return { offset: 11, label: 'Книга для уютного вечера' };
}

function BookMini({ book, label }) {
  if (!book) return null;
  return (
    <a className="discovery-book-mini" href={`/books/${book.slug}`}>
      <span className="discovery-book-cover">{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <b>B</b>}</span>
      <span><small>{label}</small><strong>{book.title}</strong><em>{book.author}</em></span>
      <ArrowRight size={17} />
    </a>
  );
}

function Ranking({ title, icon, items = [], empty, label }) {
  return (
    <article className="discovery-ranking">
      <header>{icon}<h3>{title}</h3></header>
      {items.length ? <div>{items.slice(0, 4).map((book, index) => <BookMini book={book} label={label || `№ ${index + 1}`} key={book.id} />)}</div> : <p>{empty}</p>}
    </article>
  );
}

export default function DiscoveryDashboard({ books = [] }) {
  const [data, setData] = useState(null);
  const [randomIndex, setRandomIndex] = useState(() => books.length ? dateSeed() % books.length : 0);
  const dayBook = books.length ? books[dateSeed() % books.length] : null;
  const period = dayPart();
  const greetingBook = books.length ? books[(dateSeed() + period.offset) % books.length] : null;
  const randomBook = books[randomIndex] || dayBook;
  const quoteBook = useMemo(() => books.find((book) => book.quoteOfDay) || dayBook, [books, dayBook]);

  useEffect(() => {
    fetch('/api/discovery', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then(setData).catch(() => {});
  }, []);

  const reroll = () => {
    if (books.length < 2) return;
    setRandomIndex((current) => (current + 1 + Math.floor(Math.random() * Math.max(1, books.length - 1))) % books.length);
  };

  return (
    <section className="discovery-dashboard section" aria-labelledby="discovery-title">
      <div className="section-heading discovery-heading">
        <div><span className="section-number">СЕГОДНЯ В BOOKNERD</span><h2 id="discovery-title">{greeting()}.<br /><em>Что читаем?</em></h2></div>
        <p>Ежедневная подборка меняется вместе с библиотекой и тем, что сейчас любят читатели.</p>
      </div>

      {greetingBook ? <a className="discovery-greeting-pick" href={`/books/${greetingBook.slug}`}><Sparkles size={18} /><span><small>{period.label}</small><strong>{greetingBook.title}</strong></span><ArrowRight size={17} /></a> : null}

      <div className="discovery-daily-grid">
        <article className="discovery-daily-card is-day"><Sparkles size={23} /><div><small>КНИГА ДНЯ</small><h3>{dayBook?.title || 'Новая история скоро'}</h3><p>{dayBook?.author || 'Команда BOOKNERD готовит рекомендацию.'}</p></div>{dayBook ? <a href={`/books/${dayBook.slug}`}>Открыть <ArrowRight size={16} /></a> : null}</article>
        <article className="discovery-daily-card is-random"><Dice5 size={23} /><div><small>ПОЛНОСТЬЮ СЛУЧАЙНАЯ</small><h3>{randomBook?.title || 'Испытайте удачу'}</h3><p>{randomBook?.genre || randomBook?.author || 'Одна кнопка — одна новая история.'}</p></div><button type="button" onClick={reroll}>Ещё раз</button></article>
        <article className="discovery-daily-card is-quote"><MessageCircle size={23} /><div><small>ЦИТАТА ДНЯ</small><blockquote>{quoteBook?.quoteOfDay ? `«${quoteBook.quoteOfDay}»` : '«Некоторые истории находят нас именно тогда, когда нужны.»'}</blockquote><p>{quoteBook?.title || 'BOOKNERD'}</p></div></article>
      </div>

      {data?.today?.length ? (
        <div className="discovery-today"><header><CalendarHeart size={21} /><div><small>СЕГОДНЯ ВЫШЛО</small><h3>Новые главы</h3></div></header><div>{data.today.map((item) => <a href={`/books/${item.slug}/chapters/${item.chapterId}`} key={item.chapterId}><span>{item.title}</span><strong>{item.chapterTitle || 'Новая глава'}</strong><ArrowRight size={15} /></a>)}</div></div>
      ) : null}

      <div className="discovery-ranking-grid">
        <Ranking title="Обсуждают за 24 часа" icon={<Flame size={21} />} items={data?.discussed || []} empty="Как только начнутся новые обсуждения, они появятся здесь." label="Горячее обсуждение" />
        <Ranking title="Быстро набирают популярность" icon={<TrendingUp size={21} />} items={data?.trending || []} empty="Подборка появится после первых чтений недели." label="Сейчас растёт" />
        <Ranking title="Выбор команды BOOKNERD" icon={<Sparkles size={21} />} items={data?.teamPick?.length ? data.teamPick : books.slice(0, 4)} empty="Команда готовит подборку." label="Советуем" />
      </div>

      {(data?.birthdays?.length || data?.anniversaries?.length) ? <div className="discovery-celebrations">
        {(data.birthdays || []).map((book) => <a href={`/books/${book.slug}`} key={`birthday-${book.id}`}><CakeSlice size={20} /><span><small>Сегодня день рождения автора</small><strong>{book.author}</strong></span></a>)}
        {(data.anniversaries || []).map((book) => <a href={`/books/${book.slug}`} key={`anniversary-${book.id}`}><CalendarHeart size={20} /><span><small>Годовщина выхода книги</small><strong>{book.title}</strong></span></a>)}
      </div> : null}

      {data?.records ? <div className="discovery-records">
        <header><small>ИНТЕРЕСНАЯ СТАТИСТИКА</small><h3>Книжные рекорды BOOKNERD</h3></header>
        <div>
          {[['Самая длинная', data.records.longest], ['Самая короткая', data.records.shortest], ['Самая эмоциональная', data.records.emotional], ['Самая перечитываемая', data.records.reread], ['Самая сохраняемая', data.records.saved], ['Быстрее всего читают', data.records.fast]].map(([label, book]) => book ? <a href={`/books/${book.slug}`} key={label}><small>{label}</small><strong>{book.title}</strong></a> : null)}
          {data.records.activeHours?.length ? <article><small>Самые активные часы</small><strong>{data.records.activeHours.map((item) => `${String(item.hour).padStart(2, '0')}:00`).join(' · ')}</strong></article> : null}
        </div>
      </div> : null}

      <div className="booknerd-mascot-tip" title="Пасхалка BOOKNERD"><span aria-hidden="true">🦉</span><p><strong>Маленький хранитель полки</strong>Нажмите на случайную книгу, если не знаете, что читать дальше.</p></div>
    </section>
  );
}
