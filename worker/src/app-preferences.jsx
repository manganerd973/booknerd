'use client';

import React, { useEffect, useState } from 'react';
import { MonitorCog, Moon, Palette, Sun } from 'lucide-react';

const STORAGE_KEY = 'booknerd-app-theme-v1';
const ATMOSPHERE_KEY = 'booknerd-atmosphere-v1';
export const READER_THEME_FOLLOWS_APP_KEY = 'booknerd-reader-theme-follows-app-v1';
export const APP_THEME_OPTIONS = [
  { id: 'original', label: 'BOOKNERD', description: 'Нынешнее оформление сайта', Icon: Palette },
  { id: 'white', label: 'Белое', description: 'Светлый фон и высокий контраст', Icon: Sun },
  { id: 'black', label: 'Чёрное', description: 'Тёмный фон для вечернего чтения', Icon: Moon },
  { id: 'system', label: 'Системное', description: 'Следует теме телефона или компьютера', Icon: MonitorCog },
];

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.appTheme = theme;
  document.documentElement.style.colorScheme = theme === 'black' ? 'dark' : theme === 'white' ? 'light' : '';
}

export function setStoredAppTheme(theme) {
  const valid = APP_THEME_OPTIONS.some((item) => item.id === theme) ? theme : 'original';
  try {
    localStorage.setItem(STORAGE_KEY, valid);
    localStorage.setItem(READER_THEME_FOLLOWS_APP_KEY, '1');
  } catch { /* preferences still work for this visit */ }
  applyTheme(valid);
  window.dispatchEvent(new CustomEvent('booknerd-theme-change', { detail: valid }));
}

export function getStoredAppTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY) || 'original';
    return APP_THEME_OPTIONS.some((item) => item.id === value) ? value : 'original';
  } catch {
    return 'original';
  }
}

function resolvedAtmosphere(value) {
  if (value !== 'auto') return value;
  const month = new Date().getMonth() + 1;
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'autumn';
}

export function setStoredAtmosphere(value) {
  const valid = ['auto', 'none', 'spring', 'summer', 'autumn', 'winter'].includes(value) ? value : 'none';
  try { localStorage.setItem(ATMOSPHERE_KEY, valid); } catch { /* optional */ }
  document.documentElement.dataset.atmosphere = resolvedAtmosphere(valid);
  window.dispatchEvent(new CustomEvent('booknerd-atmosphere-change', { detail: valid }));
}

export default function AppPreferences() {
  const [atmosphere, setAtmosphere] = useState('none');

  useEffect(() => {
    const saved = getStoredAppTheme();
    applyTheme(saved);
    let savedAtmosphere = 'none';
    try { savedAtmosphere = localStorage.getItem(ATMOSPHERE_KEY) || 'none'; } catch { /* optional */ }
    setAtmosphere(savedAtmosphere);
    document.documentElement.dataset.atmosphere = resolvedAtmosphere(savedAtmosphere);
    const onProfile = (event) => {
      if (!event.detail) return;
      applyTheme(event.detail);
    };
    window.addEventListener('booknerd-theme-profile', onProfile);
    const onAtmosphere = (event) => {
      setAtmosphere(event.detail || 'none');
      document.documentElement.dataset.atmosphere = resolvedAtmosphere(event.detail || 'none');
    };
    window.addEventListener('booknerd-atmosphere-change', onAtmosphere);
    return () => {
      window.removeEventListener('booknerd-theme-profile', onProfile);
      window.removeEventListener('booknerd-atmosphere-change', onAtmosphere);
    };
  }, []);

  return (
    <div className="seasonal-atmosphere" data-choice={atmosphere} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
  );
}
