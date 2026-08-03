'use client';

import React from 'react';
import { CalendarDays } from 'lucide-react';
import { ReleaseCalendar } from './home-reader-features.jsx';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

export default function CalendarPage({ books = [] }) {
  return (
    <div className="site-shell inner-site-shell calendar-page">
      <SiteHeader active="calendar" />
      <main>
        <section className="inner-hero calendar-hero">
          <span className="section-number">03 / КАЛЕНДАРЬ ГЛАВ</span>
          <div>
            <h1>Продолжения,<br /><em>которые вы ждёте.</em></h1>
            <p>Все дни выхода собраны отдельно. Включайте напоминание только для нужной книги.</p>
          </div>
          <CalendarDays className="calendar-hero-icon" size={54} aria-hidden="true" />
        </section>
        <ReleaseCalendar books={books} showHeading={false} />
      </main>
      <SiteFooter />
    </div>
  );
}
