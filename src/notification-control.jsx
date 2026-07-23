'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Check, LoaderCircle, Smartphone } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function NotificationControl({ compact = false }) {
  const [supported, setSupported] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      const available = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!available) {
        if (active) { setSupported(false); setLoading(false); }
        return;
      }
      setStandalone(isStandalone());
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (active) setSubscribed(Boolean(subscription));
      } catch {
        if (active) setSupported(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    prepare();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const enable = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Разрешение не выдано. Его можно включить позже в настройках телефона.');
      const registration = await navigator.serviceWorker.ready;
      const configResponse = await fetch('/api/notifications/config', { cache: 'no-store' });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey) throw new Error(config.error || 'Уведомления пока недоступны.');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(config.publicKey),
      });
      const json = subscription.toJSON();
      const response = await fetch('/api/notifications/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorKey: getVisitorKey(), subscription: json }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось включить уведомления.');
      setSubscribed(true);
      setNotice('Готово! Новые главы будут приходить уведомлением на телефон.');
    } catch (error) {
      setNotice(error.message || 'Не удалось включить уведомления.');
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/notifications/subscriptions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ visitorKey: getVisitorKey(), endpoint: subscription.endpoint, action: 'unsubscribe' }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setNotice('Уведомления отключены.');
    } catch {
      setNotice('Не удалось отключить уведомления. Проверьте настройки телефона.');
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return compact ? null : (
      <div className="notification-control is-unavailable">
        <BellOff size={22} />
        <div><strong>Уведомления не поддерживаются</strong><p>Сайт продолжит работать как обычно.</p></div>
      </div>
    );
  }

  return (
    <div className={`notification-control ${compact ? 'is-compact' : ''} ${subscribed ? 'is-subscribed' : ''}`}>
      <span className="notification-control-icon">{subscribed ? <Check size={22} /> : standalone ? <Bell size={22} /> : <Smartphone size={22} />}</span>
      <div>
        <strong>{subscribed ? 'Уведомления включены' : 'Не пропускайте новые главы'}</strong>
        {!compact ? <p>{standalone ? 'Разрешите уведомления — и новая глава появится на телефоне.' : 'Установите BOOKNERD на экран телефона и включите уведомления.'}</p> : null}
      </div>
      <button type="button" onClick={subscribed ? disable : enable} disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={17} /> : subscribed ? <BellOff size={17} /> : <Bell size={17} />}
        {subscribed ? 'Отключить' : 'Включить'}
      </button>
      {notice ? <small role="status">{notice}</small> : null}
    </div>
  );
}
