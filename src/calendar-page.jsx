'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const SHORT_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function ScheduleCover({ book }) {
  return <span className="schedule-book-cover">{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <b>B</b>}</span>;
}

function dayLabel(dayIndex, todayIndex) {
  if (dayIndex === todayIndex) return `Сегодня · ${SHORT_DAYS[dayIndex]}`;
  if (dayIndex === (todayIndex + 1) % 7) return `Завтра · ${SHORT_DAYS[dayIndex]}`;
  return DAYS[dayIndex];
}

function booksLabel(value) {
  const count = Number(value || 0);
  const mod100 = count % 100;
  const mod10 = count % 10;
  const word = mod100 >= 11 && mod100 <= 19 ? 'книг' : mod10 === 1 ? 'книга' : mod10 >= 2 && mod10 <= 4 ? 'книги' : 'книг';
  return `${count} ${word}`;
}

export default function CalendarPage({ books = [] }) {
  const [todayIndex, setTodayIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const scheduledBooks = useMemo(() => books.filter((book) => (book.releaseDays || []).length), [books]);
  const selectedBooks = useMemo(() => scheduledBooks.filter((book) => book.releaseDays.includes(DAYS[selectedDay])), [scheduledBooks, selectedDay]);
  const moveDay = (direction) => setSelectedDay((current) => (current + direction + 7) % 7);

  useEffect(() => {
    const current = new Date().getDay();
    setTodayIndex(current);
    setSelectedDay(current);
  }, []);

  return (
    <div className="site-shell inner-site-shell calendar-page">
      <SiteHeader active="calendar" />
      <main>
        <section className="schedule-page-head">
          <span><CalendarDays size={17} /> РАСПИСАНИЕ BOOKNERD</span>
          <h1>Когда ждать<br /><em>новую главу.</em></h1>
          <p>Выберите день недели и посмотрите, у каких историй запланировано продолжение.</p>
        </section>

        <section className="schedule-board" aria-labelledby="schedule-day-title">
          <div className="schedule-day-picker">
            <button type="button" onClick={() => moveDay(-1)} aria-label="Предыдущий день"><ChevronLeft /></button>
            <div><small>ВЫБРАННЫЙ ДЕНЬ</small><strong id="schedule-day-title">{dayLabel(selectedDay, todayIndex)}</strong><span>{DAYS[selectedDay]}</span></div>
            <button type="button" onClick={() => moveDay(1)} aria-label="Следующий день"><ChevronRight /></button>
          </div>
          <p className="schedule-count">{selectedBooks.length ? `${booksLabel(selectedBooks.length)} · по расписанию` : 'На этот день публикаций пока нет'}</p>
          {selectedBooks.length ? <div className="schedule-day-list">
            {selectedBooks.map((book) => <a href={`/books/${book.slug}`} key={book.id}>
              <ScheduleCover book={book} />
              <span><small>НОВАЯ ГЛАВА · {SHORT_DAYS[selectedDay]}</small><strong>{book.title}</strong><em>{book.status} · опубликовано {book.publishedChapterCount || 0} глав</em></span>
              <ArrowRight aria-hidden="true" />
            </a>)}
          </div> : <div className="schedule-day-empty"><BookOpen /><strong>На этот день глав пока нет</strong><p>Выберите другой день — всё расписание остаётся на этой странице.</p></div>}
        </section>

        <section className="schedule-rules" aria-labelledby="schedule-rules-title">
          <header><div><small>ПОЛНЫЙ ПЛАН</small><h2 id="schedule-rules-title">Как выходим</h2></div><Bell aria-hidden="true" /></header>
          {scheduledBooks.length ? <div>{scheduledBooks.map((book) => <article key={book.id}>
            <ScheduleCover book={book} />
            <p><a href={`/books/${book.slug}`}>{book.title}</a><span> — {book.releaseDays.join(' и ')}. {book.status}{book.progress ? ` · перевод готов на ${book.progress}%` : ''}.</span></p>
          </article>)}</div> : <p>Книги появятся здесь, когда редакция назначит дни выхода.</p>}
        </section>

        <a className="schedule-back" href="/translations"><ArrowLeft size={17} /> К каталогу</a>
      </main>
      <SiteFooter />
    </div>
  );
}
