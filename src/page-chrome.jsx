'use client';

import React, { useState } from 'react';
import { ArrowRight, Menu, Sparkles, X } from 'lucide-react';

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
  { href: '/about', label: 'О проекте', key: 'about' },
  { href: '/team', label: 'Команда', key: 'team' },
];

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
          {links.map((link) => <a className={active === link.key ? 'is-active' : ''} href={link.href} key={link.key}>{link.label}</a>)}
        </nav>
        <div className="header-actions">
          <a className="telegram-button" href="/admin">Редакционная <ArrowRight size={17} /></a>
          <button className="menu-button" onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu size={22} /></button>
        </div>
      </header>
      {open && (
        <div className="mobile-drawer">
          <div className="drawer-head"><SiteLogo /><button onClick={() => setOpen(false)} aria-label="Закрыть меню"><X /></button></div>
          <nav>
            {links.map((link, index) => <a href={link.href} key={link.key}><span>0{index + 1}</span>{link.label}</a>)}
            <a href="/admin"><span>04</span>Редакционная</a>
          </nav>
          <p>Истории, которые мы хотели прочитать сами.</p>
        </div>
      )}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <SiteLogo />
      <p>Книжная команда переводов · сделано читателями для читателей</p>
      <div><a href="/translations">Переводы</a><a href="/about">О нас</a><a href="/team">Команда</a><a href="/admin">Редакционная</a></div>
      <span>© 2026 BOOKNERD</span>
    </footer>
  );
}
