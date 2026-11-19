'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

const INSTALLED_KEY = 'booknerd-pwa-installed-v1';
const SHOWN_AT_KEY = 'booknerd-pwa-install-reminder-shown-at-v1';
const DISMISSED_AT_KEY = 'booknerd-pwa-install-reminder-dismissed-at-v1';
const SHOW_COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const DISMISS_COOLDOWN = 14 * 24 * 60 * 60 * 1000;
const APPEAR_DELAY = 8000;

function storageNumber(key) {
  try { return Number(localStorage.getItem(key) || 0); } catch { return 0; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* The reminder remains optional. */ }
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isPhone() {
  const agent = window.navigator.userAgent || '';
  return window.navigator.userAgentData?.mobile === true
    || /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile Safari/i.test(agent);
}

function isIos() {
  const agent = window.navigator.userAgent || '';
  return /iPhone|iPod/i.test(agent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

export default function PwaInstallReminder() {
  const deferredPrompt = useRef(null);
  const timer = useRef(0);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState('');
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();
    document.documentElement.dataset.pwaMode = standalone ? 'standalone' : 'browser';
    if (standalone) {
      storageSet(INSTALLED_KEY, '1');
      return undefined;
    }
    if (!isPhone() || storageNumber(INSTALLED_KEY)) return undefined;

    const now = Date.now();
    if (now - storageNumber(DISMISSED_AT_KEY) < DISMISS_COOLDOWN || now - storageNumber(SHOWN_AT_KEY) < SHOW_COOLDOWN) return undefined;

    const schedule = (nextMode) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setMode(nextMode);
        setVisible(true);
        storageSet(SHOWN_AT_KEY, Date.now());
      }, APPEAR_DELAY);
    };
    const beforeInstall = (event) => {
      event.preventDefault();
      deferredPrompt.current = event;
      schedule('prompt');
    };
    const installed = () => {
      storageSet(INSTALLED_KEY, '1');
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    if (isIos()) schedule('ios');
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const dismiss = () => {
    storageSet(DISMISSED_AT_KEY, Date.now());
    setVisible(false);
  };

  const install = async () => {
    if (mode === 'ios') {
      setShowIosSteps(true);
      return;
    }
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    deferredPrompt.current = null;
    if (choice?.outcome === 'accepted') storageSet(INSTALLED_KEY, '1');
    else storageSet(DISMISSED_AT_KEY, Date.now());
    setVisible(false);
  };

  if (!visible) return null;
  return (
    <aside className="pwa-install-reminder" aria-labelledby="pwa-install-title" aria-describedby="pwa-install-copy">
      <button className="pwa-install-close" type="button" onClick={dismiss} aria-label="Закрыть напоминание об установке"><X size={18} /></button>
      <span className="pwa-install-icon" aria-hidden="true"><img src="/booknerd-icon-v4-192.png" alt="" width="46" height="46" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} /></span>
      <div className="pwa-install-copy">
        <small>УДОБНОЕ ЧТЕНИЕ С ТЕЛЕФОНА</small>
        <strong id="pwa-install-title">Добавьте BOOKNERD на экран</strong>
        <p id="pwa-install-copy">Книги будут открываться как приложение, а сохранённые главы останутся под рукой даже без сети.</p>
        {showIosSteps ? <p className="pwa-install-ios-steps"><Share2 size={15} aria-hidden="true" /> Нажмите «Поделиться», затем — «На экран “Домой”».</p> : null}
        <div className="pwa-install-actions">
          <button type="button" onClick={install}>{mode === 'ios' ? <Share2 size={16} /> : <Download size={16} />}{mode === 'ios' ? 'Как установить' : 'Установить'}</button>
          <button type="button" onClick={dismiss}>Не сейчас</button>
        </div>
      </div>
    </aside>
  );
}
