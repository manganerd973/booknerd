'use client';

import { useEffect } from 'react';
import { getVisitorKey, trackSiteInstall } from './site-analytics.js';

export default function PwaRegister() {
  useEffect(() => {
    getVisitorKey();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The website still works normally when installation is unavailable.
      });
    }
    const installed = () => trackSiteInstall('appinstalled');
    window.addEventListener('appinstalled', installed);
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      trackSiteInstall('standalone');
    }
    return () => window.removeEventListener('appinstalled', installed);
  }, []);
  return null;
}
