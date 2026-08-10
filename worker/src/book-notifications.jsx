'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Check, LoaderCircle } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import NotificationControl from './notification-control.jsx';

const OPTIONS = [
  ['newChapter', 'Новая глава'],
  ['translationComplete', 'Завершение перевода'],
  ['authorBook', 'Новая книга автора'],
  ['commentReply', 'Ответ на комментарий'],
  ['teamNews', 'Новость команды'],
];

async function savePreferences(bookKey, preferences) {
  const response = await fetch('/api/notification-preferences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorKey: getVisitorKey(), bookKey, ...preferences }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось сохранить уведомления.');
  return data.preferences;
}

export function QuickReminderButton({ bookKey }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey(), bookKey });
    fetch(`/api/notification-preferences?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setEnabled(Boolean(data.preferences?.newChapter)))
      .catch(() => {});
  }, [bookKey]);

  const toggle = async () => {
    setLoading(true);
    try {
      const next = !enabled;
      const query = new URLSearchParams({ visitorKey: getVisitorKey(), bookKey });
      const current = await fetch(`/api/notification-preferences?${query.toString()}`, { cache: 'no-store' })
        .then((response) => response.json())
        .then((data) => data.preferences || {});
      await savePreferences(bookKey, { ...current, newChapter: next });
      setEnabled(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className={`release-reminder ${enabled ? 'is-enabled' : ''}`} type="button" onClick={toggle} disabled={loading}>
      {loading ? <LoaderCircle className="spin" size={16} /> : enabled ? <Check size={16} /> : <Bell size={16} />}
      {enabled ? 'Напоминание включено' : 'Напомнить мне'}
    </button>
  );
}

export default function BookNotificationPreferences({ bookKey, bookTitle }) {
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey(), bookKey });
    fetch(`/api/notification-preferences?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setPreferences(data.preferences || {}))
      .catch(() => setPreferences({}));
  }, [bookKey]);

  const toggle = async (key) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaving(key);
    setNotice('');
    try {
      setPreferences(await savePreferences(bookKey, next));
      setNotice('Выбор сохранён.');
    } catch (error) {
      setPreferences(preferences);
      setNotice(error.message);
    } finally {
      setSaving('');
    }
  };

  return (
    <section className="book-notification-preferences">
      <div className="book-notification-heading">
        <Bell size={25} />
        <div><small>УВЕДОМЛЕНИЯ ДЛЯ ЭТОЙ КНИГИ</small><h2>Что сообщать о «{bookTitle}»</h2></div>
      </div>
      <NotificationControl compact />
      <div className="book-notification-options">
        {OPTIONS.map(([key, label]) => (
          <label key={key}>
            <input type="checkbox" checked={Boolean(preferences?.[key])} onChange={() => toggle(key)} disabled={!preferences || saving === key} />
            <span>{saving === key ? <LoaderCircle className="spin" size={16} /> : preferences?.[key] ? <Check size={16} /> : null}</span>
            <strong>{label}</strong>
          </label>
        ))}
      </div>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
