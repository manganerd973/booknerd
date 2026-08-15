'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BookOpen, Check, Library, LoaderCircle, MessageCircle } from 'lucide-react';
import NotificationControl from './notification-control.jsx';
import { getVisitorKey } from './site-analytics.js';

export const GLOBAL_NOTIFICATION_KEY = 'booknerd-settings';

const OPTIONS = [
  ['newChapter', 'Новые главы', 'Название книги и название новой главы'],
  ['authorBook', 'Новые книги', 'Название новой книги BOOKNERD'],
  ['commentReply', 'Ответы и плюсы', 'Книга и глава, где вам ответили или поставили плюс'],
];

const OPTION_ICONS = { newChapter: BookOpen, authorBook: Library, commentReply: MessageCircle };

async function savePreferences(preferences) {
  const response = await fetch('/api/notification-preferences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorKey: getVisitorKey(), bookKey: GLOBAL_NOTIFICATION_KEY, ...preferences }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось сохранить настройки уведомлений.');
  return data.preferences;
}

export default function ProfileNotificationSettings() {
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey(), bookKey: GLOBAL_NOTIFICATION_KEY });
    fetch(`/api/notification-preferences?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setPreferences(data.preferences || {}))
      .catch(() => setPreferences({ newChapter: true, authorBook: true, commentReply: true }));
  }, []);

  const toggle = async (key) => {
    if (!preferences) return;
    const previous = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaving(key);
    setNotice('');
    try {
      setPreferences(await savePreferences(next));
      setNotice('Настройки уведомлений сохранены.');
    } catch (error) {
      setPreferences(previous);
      setNotice(error.message);
    } finally {
      setSaving('');
    }
  };

  return (
    <section className="profile-notification-settings" id="notification-settings">
      <div className="profile-section-title"><Bell size={25} /><div><small>НАСТРОЙКИ</small><h2>Уведомления</h2></div></div>
      <p>Здесь можно включить уведомления и выбрать, какие события должны приходить на телефон.</p>
      <NotificationControl compact />
      <div className="profile-notification-options">
        {OPTIONS.map(([key, label, description]) => {
          const Icon = OPTION_ICONS[key];
          return (
            <button type="button" className={preferences?.[key] ? 'is-active' : ''} onClick={() => toggle(key)} disabled={!preferences || saving === key} aria-pressed={Boolean(preferences?.[key])} key={key}>
              <Icon size={20} />
              <span><strong>{label}</strong><small>{description}</small></span>
              <i>{saving === key ? <LoaderCircle className="spin" size={16} /> : preferences?.[key] ? <Check size={16} /> : null}</i>
            </button>
          );
        })}
      </div>
      {notice ? <small className="profile-notification-notice" role="status">{notice}</small> : null}
    </section>
  );
}
