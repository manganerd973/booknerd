'use client';

import { useEffect, useState } from 'react';
import { getVisitorKey, trackSiteInstall } from './site-analytics.js';

export default function PwaRegister() {
  const [connection, setConnection] = useState('online');

  useEffect(() => {
    getVisitorKey();
    let controllerChanged = null;
    if ('serviceWorker' in navigator) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      controllerChanged = () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => registration.update()).catch(() => {
        // The website still works normally when installation is unavailable.
      });
    }
    const installed = () => trackSiteInstall('appinstalled');
    const offline = () => setConnection('offline');
    const online = () => {
      setConnection('restored');
      window.setTimeout(() => setConnection('online'), 3200);
    };
    const offlineBookNavigation = (event) => {
      if (window.navigator.onLine || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || !target.pathname.startsWith('/books/')) return;
      event.preventDefault();
      window.location.assign(target.href);
    };
    window.addEventListener('appinstalled', installed);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    window.addEventListener('click', offlineBookNavigation, true);
    if (!window.navigator.onLine) setConnection('offline');
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      trackSiteInstall('standalone');
    }
    return () => {
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      window.removeEventListener('click', offlineBookNavigation, true);
      if (controllerChanged) navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    };
  }, []);
  if (connection === 'online') return null;
  return (
    <div className={`network-status-banner is-${connection}`} role="status" aria-live="polite">
      <strong>{connection === 'offline' ? 'Сеть пропала' : 'Соединение восстановлено'}</strong>
      <span>{connection === 'offline' ? 'Сохранённые книги остаются доступны офлайн.' : 'Можно продолжать чтение.'}</span>
    </div>
  );
}
