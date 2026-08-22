'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Bookmark, LoaderCircle, Sparkles, X } from 'lucide-react';
import { loadReaderLibrary } from './reader-library.jsx';
import { getVisitorKey } from './site-analytics.js';

function chapterLabel(number, title = '') {
  const numeric = Number(number);
  const base = Number.isFinite(numeric) ? `Глава ${numeric}` : 'Последнее место';
  const cleanTitle = String(title || '').trim();
  return cleanTitle && cleanTitle.toLocaleLowerCase('ru-RU') !== base.toLocaleLowerCase('ru-RU')
    ? `${base} · ${cleanTitle}`
    : base;
}

function chapterWord(count) {
  const value = Math.abs(Number(count || 0));
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'глав';
  if (last === 1) return 'глава';
  if (last >= 2 && last <= 4) return 'главы';
  return 'глав';
}

function resumeUrl(item) {
  if (!item?.bookSlug) return '/library?tab=reading';
  if (!item.lastChapterId) return `/books/${item.bookSlug}`;
  const page = Math.max(1, Number(item.lastPage || 0) + 1);
  return `/books/${item.bookSlug}/chapters/${item.lastChapterId}?page=${page}`;
}

function groupChapterUpdates(items, library) {
  const libraryByBook = new Map(library.map((item) => [item.bookId, item]));
  const groups = new Map();

  for (const item of items) {
    if (item.type !== 'new_chapter' || item.hiddenAt || !item.bookId || !libraryByBook.has(item.bookId)) continue;
    let group = groups.get(item.bookId);
    if (!group) {
      const shelfItem = libraryByBook.get(item.bookId);
      group = {
        bookId: item.bookId,
        title: item.bookTitle || shelfItem.bookTitle || 'Книга BOOKNERD',
        slug: item.bookSlug || shelfItem.bookSlug || '',
        coverUrl: item.coverUrl || shelfItem.coverUrl || null,
        lastChapterNumber: item.lastChapterNumber ?? shelfItem.chapterNumber ?? null,
        lastChapterTitle: item.lastChapterTitle || shelfItem.chapterTitle || '',
        chapters: [],
        createdAt: item.createdAt,
      };
      groups.set(item.bookId, group);
    }
    group.chapters.push({
      id: item.id,
      number: item.chapterNumber,
      title: item.chapterTitle || item.body || '',
      url: item.url,
      createdAt: item.createdAt,
    });
    if (new Date(item.createdAt) > new Date(group.createdAt)) group.createdAt = item.createdAt;
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      chapters: group.chapters.sort((left, right) => {
        const byNumber = Number(right.number || 0) - Number(left.number || 0);
        return byNumber || new Date(right.createdAt) - new Date(left.createdAt);
      }),
    }))
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

function BookThumb({ coverUrl, title }) {
  return coverUrl
    ? <img src={coverUrl} alt={`Обложка книги «${title}»`} loading="lazy" decoding="async" />
    : <span aria-hidden="true"><BookOpen size={24} /></span>;
}

export default function ReadingNextSheet({ open, onClose }) {
  const [library, setLibrary] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError('');

    Promise.allSettled([
      loadReaderLibrary(),
      fetch(`/api/notifications?visitorKey=${encodeURIComponent(getVisitorKey())}`, { cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Не удалось проверить новые главы.');
          return Array.isArray(data.notifications) ? data.notifications : [];
        }),
    ]).then(([libraryResult, notificationsResult]) => {
      if (!active) return;
      if (libraryResult.status === 'fulfilled') setLibrary(libraryResult.value);
      if (notificationsResult.status === 'fulfilled') setNotifications(notificationsResult.value);
      if (libraryResult.status === 'rejected' && notificationsResult.status === 'rejected') {
        setError('Не удалось обновить список. Проверьте соединение и попробуйте ещё раз.');
      }
    }).finally(() => active && setLoading(false));

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  const continueItem = useMemo(() => (
    library.find((item) => item.status === 'reading' && item.lastChapterId)
    || library.find((item) => item.lastChapterId)
    || library.find((item) => item.status === 'reading')
    || library[0]
  ), [library]);
  const updates = useMemo(() => groupChapterUpdates(notifications, library), [library, notifications]);

  const openDestination = (href) => {
    onClose();
    window.location.assign(href);
  };

  const openUpdate = (item) => {
    const newest = item.chapters[0];
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorKey: getVisitorKey(), ids: item.chapters.map((chapter) => chapter.id) }),
      keepalive: true,
    }).catch(() => {});
    openDestination(newest?.url || `/books/${item.slug}`);
  };

  if (!open) return null;

  return (
    <div className="reading-next-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section id="reading-next-sheet" className="reading-next-sheet" role="dialog" aria-modal="true" aria-labelledby="reading-next-title">
        <header className="reading-next-head">
          <div><Sparkles size={17} /><h2 id="reading-next-title">Что дальше?</h2></div>
          <button type="button" onClick={onClose} aria-label="Закрыть"><X size={24} /></button>
        </header>

        {loading && !library.length && !notifications.length ? (
          <div className="reading-next-loading"><LoaderCircle className="spin" size={25} /><span>Собираем ваше чтение…</span></div>
        ) : error ? (
          <div className="reading-next-empty"><BookOpen size={29} /><strong>Список временно недоступен</strong><p>{error}</p></div>
        ) : (
          <>
            {continueItem ? (
              <button type="button" className="reading-next-continue" onClick={() => openDestination(resumeUrl(continueItem))}>
                <BookThumb coverUrl={continueItem.coverUrl} title={continueItem.bookTitle} />
                <span>
                  <small>Продолжить чтение</small>
                  <strong>{continueItem.bookTitle}</strong>
                  <em>{continueItem.chapterNumber == null ? 'Открыть книгу' : `${chapterLabel(continueItem.chapterNumber, continueItem.chapterTitle)} · вы остановились здесь`}</em>
                </span>
                <ArrowRight size={23} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="reading-next-continue is-empty" onClick={() => openDestination('/translations')}>
                <span className="reading-next-placeholder"><BookOpen size={25} /></span>
                <span><small>Начать чтение</small><strong>Выберите первую историю</strong><em>Каталог BOOKNERD уже открыт</em></span>
                <ArrowRight size={23} aria-hidden="true" />
              </button>
            )}

            <div className="reading-next-updates-head">
              <span>Новые главы в разделе «Читаю»</span>
              {updates.length ? <small>{updates.length} книг</small> : null}
            </div>

            {updates.length ? (
              <div className="reading-next-updates">
                {updates.slice(0, 5).map((item) => {
                  return (
                    <button type="button" onClick={() => openUpdate(item)} key={item.bookId}>
                      <BookThumb coverUrl={item.coverUrl} title={item.title} />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.lastChapterNumber == null ? 'Чтение ещё не начато' : `Вы на главе ${item.lastChapterNumber}`}</small>
                      </span>
                      <em>+{item.chapters.length} {chapterWord(item.chapters.length)}</em>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="reading-next-empty is-compact"><BookOpen size={26} /><strong>Новых глав пока нет</strong><p>Когда продолжение выйдет, оно появится здесь.</p></div>
            )}
          </>
        )}

        <footer className="reading-next-actions">
          <a href="/library"><Bookmark size={16} /> Все закладки</a>
          <a href="/translations"><Sparkles size={16} /> Подобрать новое</a>
        </footer>
      </section>
    </div>
  );
}
