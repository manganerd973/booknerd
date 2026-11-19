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
  return <div className="install-steps">
    {installedHere && <p>Сайт добавлен. Найдите иконку BOOKNERD на главном экране телефона и откройте её.</p>}
    <p>BOOKNERD устанавливается из браузера — искать его в App Store или Google Play не нужно.</p>
    <details open={device === 'ios'}><summary>iPhone / iPad — через Safari</summary><ol>
      <li>Откройте <strong>booknerd.bknrd.workers.dev</strong> в Safari. Если вы внутри Telegram, откройте ссылку во внешнем браузере.</li>
      <li>Нажмите кнопку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх). В некоторых версиях Safari она находится в меню «…».</li>
      <li>Прокрутите список действий и выберите <strong>«На экран „Домой“»</strong>.</li>
      <li>Если есть переключатель <strong>«Открывать как веб-приложение»</strong>, включите его. Нажмите <strong>«Добавить»</strong>.</li>
      <li>Вернитесь на домашний экран и запустите BOOKNERD с новой иконки.</li>
    </ol></details>
    <details open={device === 'android'}><summary>Android — через Chrome</summary><ol>
      <li>Откройте <strong>booknerd.bknrd.workers.dev</strong> в Chrome.</li>
      <li>Нажмите <strong>⋮</strong> справа вверху → <strong>«Добавить на главный экран»</strong> или <strong>«Установить приложение»</strong>.</li>
      <li>Подтвердите установку, затем откройте BOOKNERD с иконки на телефоне.</li>
    </ol></details>
    <p>Если пункта установки нет, откройте сайт напрямую в Safari или Chrome, а не во встроенном браузере мессенджера.</p>
    {canInstall && <button type="button" className="booknerd-install-button" onClick={install}><Download size={15} /> Установить BOOKNERD</button>}
  </div>;
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
          <img src="/booknerd-icon-v4-192.png" width="42" height="42" alt="" />
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
