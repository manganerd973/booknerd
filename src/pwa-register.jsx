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
    window.addEventListener('appinstalled', installed);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    if (!window.navigator.onLine) setConnection('offline');
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      trackSiteInstall('standalone');
    }
    return () => {
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
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
