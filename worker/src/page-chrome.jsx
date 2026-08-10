'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Home,
  Library as LibraryIcon,
  Menu,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

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

export function SiteHeader({ active = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="announcement">
        <span>✦</span><p>Истории, которые мы хотели прочитать сами</p><span className="announcement-side">переводим с любовью · глава за главой</span>
      </div>
      <header className="header page-header">
        <SiteLogo />
        <nav className="desktop-nav" aria-label="Главная навигация">
          {links.map((link) => <a className={active === link.key ? 'is-active' : ''} href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noreferrer' : undefined} key={link.key}>{link.label}</a>)}
        </nav>
        <div className="header-actions">
          <a className="icon-button" href="/search" aria-label="Расширенный поиск"><Search size={18} /></a>
          <a className="icon-button" href="/profile" aria-label="Профиль читателя"><UserRound size={18} /></a>
          <a className="telegram-button" href="/admin">Редакционная <ArrowRight size={17} /></a>
          <button className="menu-button" onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu size={22} /></button>
        </div>
      </header>
      {open && (
        <div className="mobile-drawer">
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
      <MobileBottomNavigation active={active} />
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
