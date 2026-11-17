'use client';
import React, { useEffect, useState } from 'react';
export default function AdminThemeToggle() {
  const [theme, setTheme] = useState('white');
  useEffect(() => {
    let saved = 'white';
    try { saved = localStorage.getItem('booknerd-admin-theme') === 'black' ? 'black' : 'white'; } catch {}
    setTheme(saved); document.documentElement.dataset.adminTheme = saved;
  }, []);
  return <div className="admin-theme-toggle" aria-label="Тема редакционной">{[['white','Белая'],['black','Чёрная']].map(([value,label]) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => {
    setTheme(value); document.documentElement.dataset.adminTheme = value;
    try { localStorage.setItem('booknerd-admin-theme', value); } catch {}
  }}>{label}</button>)}</div>;
}
