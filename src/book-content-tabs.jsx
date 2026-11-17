'use client';
import React, { useState } from 'react';
export default function BookContentTabs({ chaptersContent, artContent, commentsContent }) {
  const [active, setActive] = useState('chapters');
  const tabs = [['chapters', 'Главы'], ['art', 'Арты'], ['comments', 'Комментарии']];
  return <section className="book-content-tabs">
    <div role="tablist" aria-label="Разделы книги" className="book-content-tablist">
      {tabs.map(([id, label], index) => <button key={id} id={`content-tab-${id}`} type="button" role="tab" aria-selected={active === id} aria-controls={`content-panel-${id}`} tabIndex={active === id ? 0 : -1} onClick={() => setActive(id)} onKeyDown={(event) => {
        const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
        if (next < 0) return;
        event.preventDefault(); setActive(tabs[next][0]); document.getElementById(`content-tab-${tabs[next][0]}`)?.focus();
      }}>{label}</button>)}
    </div>
    <div role="tabpanel" id={`content-panel-${active}`} aria-labelledby={`content-tab-${active}`} tabIndex={0}>
      {active === 'chapters' ? chaptersContent : active === 'art' ? artContent : commentsContent}
    </div>
  </section>;
}
