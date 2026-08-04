'use client';

import React, { useEffect, useState } from 'react';
import { Check, MonitorCog, Moon, Palette, Sun, X } from 'lucide-react';

const STORAGE_KEY = 'booknerd-app-theme-v1';
const ATMOSPHERE_KEY = 'booknerd-atmosphere-v1';
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
  try { localStorage.setItem(STORAGE_KEY, valid); } catch { /* preferences still work for this visit */ }
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
  const [theme, setTheme] = useState('original');
  const [atmosphere, setAtmosphere] = useState('none');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = getStoredAppTheme();
    setTheme(saved);
    applyTheme(saved);
    let savedAtmosphere = 'none';
    try { savedAtmosphere = localStorage.getItem(ATMOSPHERE_KEY) || 'none'; } catch { /* optional */ }
    setAtmosphere(savedAtmosphere);
    document.documentElement.dataset.atmosphere = resolvedAtmosphere(savedAtmosphere);
    const onProfile = (event) => {
      if (!event.detail) return;
      setTheme(event.detail);
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

  const choose = (value) => {
    setTheme(value);
    setStoredAppTheme(value);
    setOpen(false);
  };

  return (
    <>
      <div className="seasonal-atmosphere" data-choice={atmosphere} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
      <button className="app-theme-trigger" type="button" onClick={() => setOpen(true)} aria-label="Выбрать цвет приложения"><Palette size={18} /></button>
      {open ? (
        <div className="app-theme-overlay" role="dialog" aria-modal="true" aria-label="Цвет приложения" onClick={() => setOpen(false)}>
          <section className="app-theme-dialog" onClick={(event) => event.stopPropagation()}>
            <header><div><small>ОФОРМЛЕНИЕ</small><h2>Цвет приложения</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={20} /></button></header>
            <div>
              {APP_THEME_OPTIONS.map(({ id, label, description, Icon }) => (
                <button className={theme === id ? 'is-active' : ''} type="button" onClick={() => choose(id)} key={id}>
                  <Icon size={20} /><span><strong>{label}</strong><small>{description}</small></span>{theme === id ? <Check size={17} /> : null}
                </button>
              ))}
            </div>
            <p>Шрифты, размеры и стиль BOOKNERD сохраняются во всех вариантах.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
