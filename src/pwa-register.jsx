'use client';

import { useEffect } from 'react';
import { getVisitorKey, trackSiteInstall } from './site-analytics.js';

export default function PwaRegister() {
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
    window.addEventListener('appinstalled', installed);
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      trackSiteInstall('standalone');
    }
    return () => {
      window.removeEventListener('appinstalled', installed);
      if (controllerChanged) navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    };
  }, []);
  return null;
}
