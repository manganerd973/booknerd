'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  Library,
  LoaderCircle,
  Plus,
  Sparkles,
} from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import { QuickReminderButton } from './book-notifications.jsx';

const RELEASES = [
  { title: 'Божественная империя', days: ['Понедельник', 'Четверг'], short: ['ПН', 'ЧТ'] },
  { title: '24690', days: ['Вторник', 'Суббота'], short: ['ВТ', 'СБ'] },
  { title: 'Вся эта искажённая слава', days: ['Вторник', 'Пятница'], short: ['ВТ', 'ПТ'] },
];

function formatDuration(seconds) {
  const minutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

export function ContinueReading({ items = [], books = [] }) {
  const item = items.find((entry) => entry.lastChapterId) || null;
  if (!item) return null;
  const book = books.find((entry) => entry.id === item.bookId);
  const slug = item.bookSlug || book?.slug;
  if (!slug) return null;
  return (
    <section className="continue-reading section">
      <div className="continue-reading-card">
        <div className="continue-reading-cover">
          {item.coverUrl || book?.coverUrl ? <img src={item.coverUrl || book.coverUrl} alt="" /> : <span>B</span>}
        </div>
        <div className="continue-reading-copy">
          <span><BookOpen size={15} /> ПРОДОЛЖИТЬ ЧТЕНИЕ</span>
          <h2>{item.bookTitle || book?.title}</h2>
          <p>Глава {item.chapterNumber || '—'}{item.chapterTitle ? ` · ${item.chapterTitle}` : ''}</p>
          <div><i style={{ width: `${item.progress || 0}%` }} /></div>
          <small>Вы остановились на странице {Number(item.lastPage || 0) + 1} · прочитано {item.progress || 0}%</small>
        </div>
        <a href={`/books/${slug}/chapters/${item.lastChapterId}?page=${Number(item.lastPage || 0) + 1}`}>Продолжить <ArrowRight size={18} /></a>
      </div>
    </section>
  );
}

export function ReleaseCalendar({ books = [] }) {
  const normalizedBooks = useMemo(() => new Map(books.map((book) => [book.title.toLocaleLowerCase('ru-RU'), book])), [books]);
  return (
    <section className="release-calendar section" id="release-calendar">
      <div className="section-heading">
        <div><span className="section-number">КАЛЕНДАРЬ ГЛАВ</span><h2>Когда ждать<br /><em>продолжение.</em></h2></div>
        <p>Включите напоминание только для той истории, которую действительно ждёте.</p>
      </div>
      <div className="release-calendar-grid">
        {RELEASES.map((release) => {
          const book = normalizedBooks.get(release.title.toLocaleLowerCase('ru-RU'));
          return (
            <article key={release.title}>
              <CalendarDays size={24} />
              <div><small>НОВЫЕ ГЛАВЫ</small><h3>{release.title}</h3><p>{release.days.join(' и ')}</p></div>
              <div className="release-day-badges">{release.short.map((day) => <span key={day}>{day}</span>)}</div>
              <QuickReminderButton bookKey={book?.slug || release.title} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ReaderStatistics() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey() });
    fetch(`/api/reader-stats?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setStats(data.stats || null))
      .catch(() => {});
  }, []);
  if (!stats) return null;
  return (
    <section className="reader-personal-stats section">
      <div className="reader-stats-heading">
        <div><span className="section-number">ВАШЕ ЧТЕНИЕ</span><h2>BOOKNERD <em>Wrapped</em></h2></div>
        <BarChart3 size={31} />
      </div>
      <div className="reader-stat-grid">
        <article><BookOpen size={20} /><strong>{stats.booksRead}</strong><span>книг прочитано</span></article>
        <article><Library size={20} /><strong>{stats.chaptersRead}</strong><span>глав закончено</span></article>
        <article><Clock3 size={20} /><strong>{formatDuration(stats.readingSeconds)}</strong><span>за чтением</span></article>
        <article><Flame size={20} /><strong>{stats.longestStreak}</strong><span>дней подряд</span></article>
      </div>
      <div className="reader-wrapped-card">
        <Sparkles size={27} />
        <div><small>ИТОГ ЗА {String(stats.wrapped.month || '').toLocaleUpperCase('ru-RU')}</small><strong>{stats.wrapped.chapters} глав · {formatDuration(stats.wrapped.seconds)}</strong><p>{stats.favoriteGenres?.length ? `Любимые жанры: ${stats.favoriteGenres.join(' · ')}` : 'Ваши любимые жанры появятся после чтения.'}</p>{stats.favoriteTropes?.length ? <span>Тропы месяца: {stats.favoriteTropes.join(' · ')}</span> : null}</div>
      </div>
    </section>
  );
}

export function TranslationVoting() {
  const [candidates, setCandidates] = useState([]);
  const [suggestion, setSuggestion] = useState({ title: '', author: '' });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  const reload = () => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey() });
    return fetch(`/api/translation-voting?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setCandidates(data.candidates || []));
  };
  useEffect(() => { reload().catch(() => {}); }, []);

  const send = async (payload) => {
    setSending(true);
    setNotice('');
    try {
      const response = await fetch('/api/translation-voting', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorKey: getVisitorKey(), ...payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось отправить выбор.');
      await reload();
      return data;
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="translation-voting section">
      <div className="section-heading">
        <div><span className="section-number">БУДУЩИЕ ПЕРЕВОДЫ</span><h2>Что читать<br /><em>следующим.</em></h2></div>
        <p>Предлагайте книги. Команда перенесёт подходящие варианты в официальное голосование.</p>
      </div>
      <div className="translation-voting-layout">
        <div className="translation-candidates">
          {candidates.length ? candidates.map((candidate) => (
            <article className={candidate.voted ? 'is-voted' : ''} key={candidate.id}>
              <div><small>{candidate.author || 'Автор не указан'}</small><h3>{candidate.title}</h3><span>{candidate.votes} голосов</span></div>
              <button type="button" onClick={() => send({ candidateId: candidate.id }).catch((error) => setNotice(error.message))} disabled={sending}>{candidate.voted ? <Check size={17} /> : <Plus size={17} />}{candidate.voted ? 'Ваш голос' : 'Голосовать'}</button>
            </article>
          )) : <div className="translation-voting-empty"><Bell size={25} /><p>Команда пока готовит официальные варианты.</p></div>}
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          send({ action: 'suggest', ...suggestion })
            .then(() => { setSuggestion({ title: '', author: '' }); setNotice('Предложение отправлено команде.'); })
            .catch((error) => setNotice(error.message));
        }}>
          <h3>Предложить книгу</h3>
          <label><span>Название</span><input value={suggestion.title} onChange={(event) => setSuggestion({ ...suggestion, title: event.target.value })} required /></label>
          <label><span>Автор</span><input value={suggestion.author} onChange={(event) => setSuggestion({ ...suggestion, author: event.target.value })} /></label>
          <button type="submit" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Отправить команде</button>
          {notice ? <p role="status">{notice}</p> : null}
        </form>
      </div>
      <div className="translation-voting-disclaimer">Голосование не является обещанием перевода.</div>
    </section>
  );
}
