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

function isIOS() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function subscriptionUsesKey(subscription, publicKey) {
  const current = subscription?.options?.applicationServerKey;
  if (!current || !publicKey) return true;
  const expected = base64UrlToUint8Array(publicKey);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

async function saveSubscription(subscription, { silent = false } = {}) {
  const response = await fetch('/api/notifications/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorKey: getVisitorKey(), subscription: subscription.toJSON(), silent }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось включить уведомления.');
  return data;
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
        let subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const configResponse = await fetch('/api/notifications/config', { cache: 'no-store' });
          const config = await configResponse.json().catch(() => ({}));
          if (configResponse.ok && config.publicKey && !subscriptionUsesKey(subscription, config.publicKey)) {
            await subscription.unsubscribe();
            subscription = null;
            if (active) setNotice('Ключ уведомлений обновлён. Нажмите «Включить» ещё раз.');
          } else {
            // Restore the server record after a database migration or deploy.
            await saveSubscription(subscription, { silent: true });
          }
        }
        if (active) setSubscribed(Boolean(subscription));
      } catch {
        if (active) setSubscribed(false);
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
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !subscriptionUsesKey(subscription, config.publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(config.publicKey),
        });
      }
      const data = await saveSubscription(subscription);
      setSubscribed(true);
      setNotice(data.testSent
        ? 'Готово! Проверочное уведомление отправлено на телефон.'
        : 'Уведомления включены, но проверочное сообщение не доставлено. Проверьте разрешение телефона.');
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

  const test = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setSubscribed(false);
        throw new Error('Подписка потеряна. Нажмите «Включить», чтобы восстановить её.');
      }
      const data = await saveSubscription(subscription);
      setNotice(data.testSent
        ? 'Проверочное уведомление отправлено на телефон.'
        : 'Телефон не подтвердил доставку. Проверьте разрешение уведомлений в его настройках.');
    } catch (error) {
      setNotice(error.message || 'Не удалось отправить проверочное уведомление.');
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    const message = isIOS() && !standalone
      ? 'На iPhone сначала добавьте BOOKNERD на экран «Домой», затем откройте приложение и включите уведомления здесь.'
      : 'Этот браузер не поддерживает push-уведомления.';
    return (
      <div id={compact ? undefined : 'notifications'} className={`notification-control is-unavailable ${compact ? 'is-compact' : ''}`}>
        <BellOff size={22} />
        <div><strong>Уведомления недоступны</strong><p>{message}</p></div>
      </div>
    );
  }

  return (
    <div id={compact ? undefined : 'notifications'} className={`notification-control ${compact ? 'is-compact' : ''} ${subscribed ? 'is-subscribed' : ''}`}>
      <span className="notification-control-icon">{subscribed ? <Check size={22} /> : standalone ? <Bell size={22} /> : <Smartphone size={22} />}</span>
      <div>
        <strong>{subscribed ? 'Уведомления включены' : 'Не пропускайте новые главы'}</strong>
        {!compact ? <p>{standalone ? 'Разрешите уведомления — и новая глава появится на телефоне.' : 'Установите BOOKNERD на экран телефона и включите уведомления.'}</p> : null}
      </div>
      <div className="notification-control-actions">
        <button type="button" onClick={subscribed ? test : enable} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={17} /> : <Bell size={17} />}
          {subscribed ? 'Проверить' : 'Включить'}
        </button>
        {subscribed ? <button className="is-secondary" type="button" onClick={disable} disabled={loading}><BellOff size={17} />Отключить</button> : null}
      </div>
      {notice ? <small role="status">{notice}</small> : null}
    </div>
  );
}
