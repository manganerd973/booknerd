'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bell, BellRing, BookOpen, CheckCheck, LoaderCircle, MessageCircle, Plus, Settings } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const FILTERS = [
  ['all', 'Все'],
  ['unread', 'Непрочитанные'],
  ['new_chapter', 'Новые главы'],
  ['comments', 'Комментарии'],
];

const TYPE_META = {
  new_chapter: { label: 'Новая глава', icon: BookOpen },
  comment_reply: { label: 'Ответ', icon: MessageCircle },
  comment_upvote: { label: 'Плюс', icon: Plus },
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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
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

  const visible = useMemo(() => notifications.filter((item) => {
    if (filter === 'unread') return !item.readAt;
    if (filter === 'comments') return item.type === 'comment_reply' || item.type === 'comment_upvote';
    if (filter === 'new_chapter') return item.type === 'new_chapter';
    return true;
  }), [filter, notifications]);

  const openNotification = async (item) => {
    setSaving(item.id);
    if (!item.readAt) {
      setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
      try { await notificationApi({ method: 'POST', body: { id: item.id } }); } catch { /* The destination still opens. */ }
    }
    window.location.assign(item.url);
  };

  const markAllRead = async () => {
    setSaving('all');
    setError('');
    try {
      const data = await notificationApi({ method: 'POST', body: { action: 'mark-all-read' } });
      const readAt = data.readAt || new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
      setUnreadCount(0);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving('');
    }
  };

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
              {visible.map((item) => {
                const meta = TYPE_META[item.type] || { label: 'BOOKNERD', icon: Bell };
                const Icon = meta.icon;
                return (
                  <button type="button" className={item.readAt ? 'is-read' : 'is-unread'} onClick={() => openNotification(item)} disabled={saving === item.id} key={item.id}>
                    <span className="notification-item-icon"><Icon size={21} /></span>
                    <span className="notification-item-copy">
                      <small>{meta.label} · {formatDate(item.createdAt)}</small>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </span>
                    <span className="notification-item-open">{saving === item.id ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={19} />}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="notifications-empty"><Bell size={32} /><strong>Здесь пока тихо</strong><p>{filter === 'new_chapter' ? 'Новые главы появятся здесь для книг из раздела «Читаю».' : 'Подходящих уведомлений пока нет.'}</p></div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
