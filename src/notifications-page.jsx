'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  BookOpen,
  CheckCheck,
  EyeOff,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const FILTERS = [
  ['all', 'Все'],
  ['unread', 'Новые'],
  ['new_chapter', 'Главы'],
  ['comments', 'Комментарии'],
  ['hidden', 'Скрытые'],
];

const TYPE_META = {
  comment_reply: { label: 'Ответ на комментарий', icon: MessageCircle },
  comment_upvote: { label: 'Плюс к комментарию', icon: Plus },
};

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dushanbe',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function formatRelative(value) {
  const milliseconds = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return formatDate(value);
  const minutes = Math.max(1, Math.floor(milliseconds / 60000));
  if (minutes < 60) return new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' }).format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' }).format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' }).format(-days, 'day');
  return formatDate(value);
}

function chapterName(number, title) {
  const base = number == null ? 'Новая глава' : `Глава ${number}`;
  const cleanTitle = String(title || '').trim();
  return cleanTitle && cleanTitle.toLocaleLowerCase('ru-RU') !== base.toLocaleLowerCase('ru-RU')
    ? `${base} · ${cleanTitle}`
    : base;
}

function groupNotifications(items) {
  const result = [];
  const groups = new Map();
  for (const item of items) {
    if (item.type !== 'new_chapter' || !item.bookId) {
      result.push({ ...item, ids: [item.id] });
      continue;
    }
    const key = `${item.bookId}:${item.hiddenAt ? 'hidden' : 'visible'}`;
    let group = groups.get(key);
    if (!group) {
      group = { ...item, ids: [], chapters: [] };
      groups.set(key, group);
      result.push(group);
    }
    group.ids.push(item.id);
    group.chapters.push({
      id: item.id,
      chapterId: item.chapterId,
      chapterNumber: item.chapterNumber,
      chapterTitle: item.chapterTitle || item.body,
      url: item.url,
      readAt: item.readAt,
      hiddenAt: item.hiddenAt,
      createdAt: item.createdAt,
    });
  }
  for (const group of groups.values()) {
    group.readAt = group.chapters.every((chapter) => chapter.readAt) ? group.chapters[0]?.readAt : null;
    group.hiddenAt = group.chapters.every((chapter) => chapter.hiddenAt) ? group.chapters[0]?.hiddenAt : null;
  }
  return result.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

async function notificationApi(options = {}) {
  const visitorKey = getVisitorKey();
  if (!options.method) {
    const response = await fetch(`/api/notifications?visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось открыть уведомления.');
    return data;
  }
  const response = await fetch('/api/notifications', {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify({ visitorKey, ...(options.body || {}) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось обновить уведомления.');
  return data;
}

function BookCover({ item }) {
  return item.coverUrl ? (
    <img className="notification-book-cover" src={item.coverUrl} alt={`Обложка книги «${item.bookTitle || item.title}»`} loading="lazy" decoding="async" />
  ) : (
    <span className="notification-book-cover is-placeholder"><BookOpen size={25} /></span>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [openMenu, setOpenMenu] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    notificationApi()
      .then((data) => {
        if (!active) return;
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount || 0));
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);
  const visible = useMemo(() => grouped.filter((item) => {
    if (filter === 'hidden') return Boolean(item.hiddenAt);
    if (item.hiddenAt) return false;
    if (filter === 'unread') return !item.readAt;
    if (filter === 'comments') return item.type === 'comment_reply' || item.type === 'comment_upvote';
    if (filter === 'new_chapter') return item.type === 'new_chapter';
    return true;
  }), [filter, grouped]);

  const updateLocalItems = (ids, changes) => {
    const selected = new Set(ids);
    setNotifications((current) => current.map((entry) => selected.has(entry.id) ? { ...entry, ...changes } : entry));
  };

  const openNotification = async (item, destination = item.url) => {
    const ids = item.ids || [item.id];
    setSaving(item.id);
    setOpenMenu('');
    if (!item.readAt) {
      const readAt = new Date().toISOString();
      const newlyRead = notifications.filter((entry) => ids.includes(entry.id) && !entry.readAt && !entry.hiddenAt).length;
      updateLocalItems(ids, { readAt });
      setUnreadCount((count) => Math.max(0, count - newlyRead));
      try { await notificationApi({ method: 'POST', body: { ids } }); } catch { /* The destination still opens. */ }
    }
    window.location.assign(destination);
  };

  const markAllRead = async () => {
    setSaving('all');
    setError('');
    try {
      const data = await notificationApi({ method: 'POST', body: { action: 'mark-all-read' } });
      const readAt = data.readAt || new Date().toISOString();
      setNotifications((current) => current.map((item) => item.hiddenAt ? item : { ...item, readAt: item.readAt || readAt }));
      setUnreadCount(0);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving('');
    }
  };

  const hideRead = async () => {
    setSaving('hide-read');
    setError('');
    try {
      const now = new Date().toISOString();
      await notificationApi({ method: 'POST', body: { action: 'hide-read' } });
      setNotifications((current) => current.map((item) => item.readAt && !item.hiddenAt ? { ...item, hiddenAt: now } : item));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving('');
    }
  };

  const toggleHidden = async (item) => {
    const ids = item.ids || [item.id];
    const restoring = Boolean(item.hiddenAt);
    const now = new Date().toISOString();
    setSaving(item.id);
    setOpenMenu('');
    try {
      const data = await notificationApi({ method: 'POST', body: { action: restoring ? 'restore' : 'hide', ids } });
      updateLocalItems(ids, restoring ? { hiddenAt: null } : { hiddenAt: now, readAt: now });
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving('');
    }
  };

  const renderMenu = (item) => (
    <div className="notification-card-menu-wrap">
      <button type="button" className="notification-card-menu-button" aria-label={item.hiddenAt ? 'Вернуть уведомление' : 'Действия с уведомлением'} aria-expanded={openMenu === item.id} onClick={() => setOpenMenu((current) => current === item.id ? '' : item.id)}>
        <MoreHorizontal size={20} />
      </button>
      {openMenu === item.id ? (
        <button type="button" className="notification-card-menu-popover" onClick={() => toggleHidden(item)}>
          {item.hiddenAt ? <RotateCcw size={15} /> : <EyeOff size={15} />}
          {item.hiddenAt ? 'Вернуть' : 'Скрыть'}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="site-shell inner-site-shell notifications-page">
      <SiteHeader active="notifications" />
      <main>
        <section className="inner-hero notifications-hero">
          <span className="section-number">05 / УВЕДОМЛЕНИЯ</span>
          <div>
            <h1>Всё важное —<br /><em>в одном месте.</em></h1>
            <p>Новые главы книг из «Читаю», ответы и плюсы к вашим комментариям.</p>
          </div>
        </section>

        <section className="notifications-page-content">
          <div className="notifications-mobile-head">
            <h1><Bell size={24} /> Уведомления</h1>
            <button type="button" onClick={hideRead} disabled={saving === 'hide-read'}>{saving === 'hide-read' ? <LoaderCircle className="spin" size={16} /> : <EyeOff size={16} />} Скрыть прочитанные</button>
          </div>

          <div className="notifications-toolbar">
            <div>
              <BellRing size={24} />
              <span><strong>{unreadCount}</strong><small>непрочитанных</small></span>
            </div>
            <div>
              <button type="button" onClick={markAllRead} disabled={!unreadCount || saving === 'all'}>
                {saving === 'all' ? <LoaderCircle className="spin" size={17} /> : <CheckCheck size={17} />}
                Прочитать все
              </button>
              <a href="/profile#notification-settings"><Settings size={17} /> Настройки push</a>
            </div>
          </div>

          <div className="notifications-filters" role="tablist" aria-label="Фильтр уведомлений">
            {FILTERS.map(([value, label]) => (
              <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)} key={value}>{label}</button>
            ))}
          </div>

          {loading ? (
            <div className="notifications-empty"><LoaderCircle className="spin" size={30} /><strong>Собираем уведомления…</strong></div>
          ) : error ? (
            <div className="notifications-empty is-error"><Bell size={30} /><strong>{error}</strong><button type="button" onClick={() => window.location.reload()}>Попробовать снова</button></div>
          ) : visible.length ? (
            <div className="notifications-list">
              {visible.map((item) => item.type === 'new_chapter' ? (
                <article className={`notification-book-card ${item.readAt ? 'is-read' : 'is-unread'} ${item.hiddenAt ? 'is-hidden' : ''}`} key={`${item.bookId}-${item.hiddenAt ? 'hidden' : 'visible'}`}>
                  <header>
                    <BookCover item={item} />
                    <div>
                      <small>Книга из раздела «Читаю»</small>
                      <h2>{item.bookTitle || item.title.replace(/^Новая глава:\s*/i, '')}</h2>
                    </div>
                    {renderMenu(item)}
                  </header>
                  <div className="notification-chapter-update">
                    <strong>{item.chapters?.length > 1 ? 'Вышли новые главы' : 'Вышла новая глава'}</strong>
                    <div className="notification-chapter-list">
                      {(item.chapters || []).slice(0, 3).map((chapter) => (
                        <button type="button" onClick={() => openNotification(item, chapter.url)} disabled={saving === item.id} key={chapter.id}>
                          <span>{chapterName(chapter.chapterNumber, chapter.chapterTitle)}</span>
                          <time>{formatRelative(chapter.createdAt)}</time>
                        </button>
                      ))}
                      {(item.chapters?.length || 0) > 3 ? <small>Ещё глав: {item.chapters.length - 3}</small> : null}
                    </div>
                  </div>
                  <div className="notification-reading-position">
                    <span>
                      <small>Вы остановились</small>
                      <strong>{item.lastChapterNumber == null ? 'Чтение ещё не начато' : chapterName(item.lastChapterNumber, item.lastChapterTitle)}</strong>
                      {item.lastChapterNumber != null && item.lastPage > 0 ? <em>Страница {item.lastPage + 1}</em> : null}
                    </span>
                    <div>
                      <button type="button" className="is-primary" onClick={() => openNotification(item, item.chapters?.[0]?.url || item.url)} disabled={saving === item.id}>
                        {saving === item.id ? <LoaderCircle className="spin" size={17} /> : <BookOpen size={17} />}
                        К новой главе {item.chapters?.[0]?.chapterNumber ?? ''}
                      </button>
                      {item.resumeUrl && item.lastChapterId !== item.chapters?.[0]?.chapterId ? (
                        <button type="button" onClick={() => openNotification(item, item.resumeUrl)} disabled={saving === item.id}>Продолжить с главы {item.lastChapterNumber}</button>
                      ) : null}
                    </div>
                  </div>
                  <footer><time>{formatDate(item.createdAt)}</time>{item.readAt ? <span>Прочитано</span> : <span>Новое</span>}</footer>
                </article>
              ) : (
                <article className={`notification-social-card ${item.readAt ? 'is-read' : 'is-unread'} ${item.hiddenAt ? 'is-hidden' : ''}`} key={item.id}>
                  <BookCover item={item} />
                  <div>
                    <small>{TYPE_META[item.type]?.label || 'BOOKNERD'} · {formatRelative(item.createdAt)}</small>
                    <h2>{item.bookTitle || item.title}</h2>
                    <p>{item.body}</p>
                    <button type="button" onClick={() => openNotification(item)} disabled={saving === item.id}>
                      {React.createElement(TYPE_META[item.type]?.icon || Bell, { size: 17 })}
                      {item.type === 'comment_reply' ? 'Открыть ответ' : 'Открыть комментарий'}
                    </button>
                  </div>
                  {renderMenu(item)}
                </article>
              ))}
            </div>
          ) : (
            <div className="notifications-empty"><Bell size={32} /><strong>{filter === 'hidden' ? 'Скрытых уведомлений нет' : 'Здесь пока тихо'}</strong><p>{filter === 'new_chapter' ? 'Новые главы появятся здесь для книг из раздела «Читаю».' : 'Подходящих уведомлений пока нет.'}</p></div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
