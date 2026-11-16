'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  Compass,
  Clock3,
  Settings,
  Users,
  Moon,
  Sun,
  CalendarDays,
  Home,
  Library as LibraryIcon,
  Menu,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useBooknerdInstall } from './pwa-register.jsx';
import { getVisitorKey } from './site-analytics.js';
import { getStoredAppTheme, setStoredAppTheme } from './app-preferences.jsx';

export function SiteLogo() {
  return (
    <a className="logo" href="/" aria-label="BOOKNERD — на главную">
      <span className="logo-mark" aria-hidden="true"><span>B</span><Sparkles size={13} strokeWidth={2.5} /></span>
      <span className="logo-name">BOOKNERD<span>.</span></span>
    </a>
  );
}

const links = [
  { href: '/translations', label: 'Переводы', key: 'translations' },
  { href: '/library', label: 'Моя библиотека', key: 'library' },
  { href: '/calendar', label: 'Календарь глав', key: 'calendar' },
  { href: '/community', label: 'Сообщество', key: 'community' },
  { href: '/about', label: 'О проекте', key: 'about' },
  { href: '/team', label: 'Команда', key: 'team' },
  { href: '/go/telegram', label: 'Telegram', key: 'telegram', external: true },
];

const quickLinks = [
  { href: '/', label: 'Главная', key: 'home', icon: Home },
  { href: '/library', label: 'Библиотека', key: 'library', icon: LibraryIcon },
  { href: '/search', label: 'Поиск', key: 'search', icon: Search },
  { href: '/calendar', label: 'Календарь', key: 'calendar', icon: CalendarDays },
  { href: '/library#notifications', label: 'Уведомления', key: 'notifications', icon: Bell },
  { href: '/profile', label: 'Профиль', key: 'profile', icon: UserRound },
];

export function MobileQuickNavigation({ active = '' }) {
  return (
    <nav className="mobile-quick-navigation" aria-label="Быстрые разделы">
      {quickLinks.map(({ href, label, key, icon: Icon }) => (
        <a className={active === key ? 'is-active' : ''} href={href} aria-current={active === key ? 'page' : undefined} key={key}>
          <Icon size={19} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

export function MobileBottomNavigation({ active = '' }) {
  const bottomLinks = quickLinks;
  return (
    <nav className="mobile-bottom-navigation" aria-label="Основные разделы">
      {bottomLinks.map(({ href, label, key, icon: Icon }) => (
        <a className={active === key ? 'is-active' : ''} href={href} aria-current={active === key ? 'page' : undefined} key={key}>
          <Icon size={20} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

export function ThemeButton() {
  const [dark, setDark] = useState(false);
  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const theme = document.documentElement.dataset.appTheme || getStoredAppTheme();
      setDark(theme === 'black' || ((theme === 'system' || theme === 'original') && media.matches));
    };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('booknerd-theme-change', sync);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('booknerd-theme-change', sync);
    };
  }, []);
  const Icon = dark ? Sun : Moon;
  return <button className="icon-button" type="button" aria-label={dark ? 'Светлая тема' : 'Тёмная тема'} onClick={() => {
    setStoredAppTheme(dark ? 'white' : 'black');
    setDark(!dark);
  }}><Icon size={19} /></button>;
}

export function ShelfNavigation({ active, continueHref = '/#continue-reading' }) {
  const items = [
    ['home', '/', 'Главная', Home],
    ['translations', '/translations', 'Каталог', Compass],
    ['continue', continueHref, 'Продолжить', BookOpen],
    ['library', '/library', 'Закладки', Bookmark],
    ['profile', '/profile', 'Профиль', UserRound],
  ];
  return <nav className="home-bottom-nav" aria-label="Основные разделы">{items.map(([key, href, title, Icon]) =>
    <a key={key} href={href} aria-current={active === key ? 'page' : undefined}><Icon size={21} />{title}</a>
  )}</nav>;
}

export function ProfileMenu() {
  const { installed } = useBooknerdInstall();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      menuRef.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  React.useEffect(() => {
    const updateName = (event) => setName(event.detail || '');
    window.addEventListener('booknerd-profile-name', updateName);
    return () => window.removeEventListener('booknerd-profile-name', updateName);
  }, []);

  if (!installed) return null;
  const toggle = () => {
    setOpen(!open);
    if (open || name) return;
    fetch(`/api/reader-hub?summary=1&visitorKey=${encodeURIComponent(getVisitorKey())}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.displayName) setName(data.displayName); })
      .catch(() => {});
  };

  return (
    <div className="profile-menu" ref={menuRef}>
      <button type="button" className="icon-button" aria-label="Меню профиля" aria-expanded={open} onClick={toggle}><UserRound size={19} /></button>
      {open && <nav className="profile-menu-panel" aria-label="Разделы профиля">
        <strong>{name || 'Читатель Booknerd'}</strong>
        <a href="/profile" onClick={() => setOpen(false)}><UserRound size={17} /> Мой профиль</a>
        <a href="/profile#profile-settings" onClick={() => setOpen(false)}><Settings size={17} /> Настройки профиля</a>
        <a href="/library" onClick={() => setOpen(false)}><Bookmark size={17} /> Библиотека</a>
        <a href="/profile#profile-history" onClick={() => setOpen(false)}><Clock3 size={17} /> История чтения</a>
        <a href="/team" onClick={() => setOpen(false)}><Users size={17} /> Команда Booknerd</a>
      </nav>}
    </div>
  );
}

export function SiteHeader({ active = '', compact = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!compact && <div className="announcement">
        <span>✦</span><p>Истории, которые мы хотели прочитать сами</p><span className="announcement-side">переводим с любовью · глава за главой</span>
      </div>}
      <header className={compact ? "home-header" : "header page-header"}>
        {compact && <button className="home-menu-button" type="button" onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu size={22} /></button>}
        <SiteLogo />
        <nav className="desktop-nav" aria-label="Главная навигация">
          {links.map((link) => <a className={active === link.key ? 'is-active' : ''} href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noreferrer' : undefined} key={link.key}>{link.label}</a>)}
        </nav>
        <div className="header-actions">
          <a className="icon-button" href="/search" aria-label="Расширенный поиск"><Search size={18} /></a>
          {compact && <ThemeButton />}
          <ProfileMenu />
          {!compact && <a className="telegram-button" href="/admin">Редакционная <ArrowRight size={17} /></a>}
          {!compact && <button className="menu-button" onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu size={22} /></button>}
        </div>
      </header>
      {open && (
        <div className={compact ? "mobile-drawer home-drawer" : "mobile-drawer"}>
          <div className="drawer-head"><SiteLogo /><button onClick={() => setOpen(false)} aria-label="Закрыть меню"><X /></button></div>
          <nav>
            {links.map((link, index) => <a href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noreferrer' : undefined} key={link.key}><span>0{index + 1}</span>{link.label}</a>)}
            <a href="/search"><span>08</span>Расширенный поиск</a>
            <a href="/profile"><span>09</span>Профиль читателя</a>
            <a href="/admin"><span>10</span>Редакционная</a>
          </nav>
          <p>Истории, которые мы хотели прочитать сами.</p>
        </div>
      )}
      {compact ? <ShelfNavigation active={active} /> : <MobileBottomNavigation active={active} />}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <SiteLogo />
      <p>Книжная команда переводов · сделано читателями для читателей</p>
      <div><a href="/translations">Переводы</a><a href="/library">Моя библиотека</a><a href="/calendar">Календарь</a><a href="/community">Сообщество</a><a href="/profile">Профиль</a><a href="/search">Поиск</a><a href="/about">О нас</a><a href="/team">Команда</a><a href="/go/telegram" target="_blank" rel="noreferrer">Telegram</a><a href="/admin">Редакционная</a></div>
      <span>© 2026 BOOKNERD</span>
    </footer>
  );
}
