'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { getVisitorKey, trackSiteInstall } from './site-analytics.js';

const DISMISSAL_KEY = 'booknerd-install-banner-dismissed';
const InstallContext = createContext({ device: null, installed: false, canInstall: false, install: async () => {}, installedHere: false });

function getDevice() {
  const { userAgent, platform, maxTouchPoints, userAgentData } = navigator;
  if (/iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return userAgentData?.mobile || /Mobile/i.test(userAgent) ? 'mobile' : 'desktop';
}

function wasDismissedOnThisVisit() {
  try {
    const navigation = performance.getEntriesByType('navigation')[0];
    const internal = document.referrer && new URL(document.referrer).origin === location.origin;
    if (!internal || navigation?.type === 'reload') sessionStorage.removeItem(DISMISSAL_KEY);
    return sessionStorage.getItem(DISMISSAL_KEY) === '1';
  } catch { return false; }
}

export function useBooknerdInstall() {
  return useContext(InstallContext);
}

export function InstallInstructions() {
  const { device, canInstall, install, installedHere } = useBooknerdInstall();
  if (device === 'desktop') return <p>Откройте Booknerd на телефоне, добавьте его на главный экран и запустите с иконки.</p>;
  if (installedHere) return <p>Теперь откройте Booknerd с иконки на главном экране, чтобы перейти в профиль.</p>;
  return (
    <>
      {device === 'ios'
        ? <p>Откройте в Safari, нажмите <strong>«Поделиться»</strong>, затем <strong>«На экран „Домой“»</strong>.</p>
        : <p>В меню браузера выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.</p>}
      {canInstall && <button type="button" className="booknerd-install-button" onClick={install}><Download size={15} /> Установить</button>}
    </>
  );
}

export default function PwaRegister({ children }) {
  const [device, setDevice] = useState(null);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [installedHere, setInstalledHere] = useState(false);
  const [showOnPage, setShowOnPage] = useState(false);

  useEffect(() => {
    const currentDevice = getDevice();
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const syncMode = () => {
      const app = displayMode.matches || navigator.standalone === true;
      setStandalone(app);
      document.documentElement.dataset.profileAvailable = String(app && currentDevice !== 'desktop');
      if (app) trackSiteInstall('standalone');
    };
    const onPrompt = (event) => {
      if (currentDevice === 'desktop' || /^\/admin(?:\/|$)/.test(location.pathname)) return;
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => {
      trackSiteInstall('appinstalled');
      setPrompt(null);
      setInstalledHere(true);
    };

    setDevice(currentDevice);
    setDismissed(wasDismissedOnThisVisit());
    setShowOnPage(!/^\/(?:admin(?:\/|$)|reader-access(?:\/|$)|profile\/?$)/.test(location.pathname));
    getVisitorKey();
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', syncMode);
    syncMode();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', syncMode);
      delete document.documentElement.dataset.profileAvailable;
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSAL_KEY, '1'); } catch { /* The current page can still dismiss it. */ }
  };

  const install = async () => {
    if (!prompt) return;
    setPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') setInstalledHere(true);
    } catch { /* The manual installation instructions remain available. */ }
  };

  const installed = standalone && device !== 'desktop';
  return (
    <InstallContext.Provider value={{ device, installed, canInstall: Boolean(prompt), install, installedHere }}>
      {children}
      {device && !standalone && showOnPage && !dismissed && (
        <aside className="booknerd-install-banner" aria-label="Установка Booknerd">
          <img src="/booknerd-icon-v2-192.png" width="42" height="42" alt="" />
          <div>
            <strong>Установите Booknerd на телефон</strong>
            <InstallInstructions />
          </div>
          <button type="button" className="booknerd-install-close" onClick={dismiss} aria-label="Закрыть подсказку"><X size={19} /></button>
        </aside>
      )}
    </InstallContext.Provider>
  );
}
