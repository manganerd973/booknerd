'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Minus, Moon, Plus, Sun } from 'lucide-react';

export default function ReaderView({ book, chapter, previous, next }) {
  const [fontSize, setFontSize] = useState(20);
  const [theme, setTheme] = useState('paper');
  const [progress, setProgress] = useState(0);
  const paragraphs = useMemo(() => String(chapter.body || '').split(/\n{2,}/).filter(Boolean), [chapter.body]);

  useEffect(() => {
    try {
      const savedSize = Number(localStorage.getItem('booknerd-reader-size'));
      const savedTheme = localStorage.getItem('booknerd-reader-theme');
      if (savedSize >= 17 && savedSize <= 26) setFontSize(savedSize);
      if (['paper', 'night'].includes(savedTheme)) setTheme(savedTheme);
    } catch { /* browser storage is optional */ }
  }, []);

  useEffect(() => {
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(100, Math.max(0, (window.scrollY / height) * 100)) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);

  const changeSize = (value) => {
    const size = Math.min(26, Math.max(17, value));
    setFontSize(size);
    try { localStorage.setItem('booknerd-reader-size', String(size)); } catch { /* optional */ }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'paper' ? 'night' : 'paper';
    setTheme(nextTheme);
    try { localStorage.setItem('booknerd-reader-theme', nextTheme); } catch { /* optional */ }
  };

  return (
    <main className={`reader-page reader-theme-${theme}`} style={{ '--reader-font-size': `${fontSize}px` }}>
      <div className="reader-scroll-progress" style={{ width: `${progress}%` }} />
      <header className="reader-header">
        <a className="editorial-brand" href="/"><span>B</span><strong>BOOKNERD.</strong></a>
        <div className="reader-toolbar" aria-label="Настройки чтения">
          <button onClick={() => changeSize(fontSize - 1)} aria-label="Уменьшить текст"><Minus size={16} /> A</button>
          <button onClick={() => changeSize(fontSize + 1)} aria-label="Увеличить текст">A <Plus size={16} /></button>
          <button onClick={toggleTheme} aria-label="Изменить тему">{theme === 'paper' ? <Moon size={17} /> : <Sun size={17} />}</button>
          <a href={`/books/${book.slug}`}><BookOpen size={17} /> О книге</a>
        </div>
      </header>

      <article className="reader-article">
        <a className="reader-back" href={`/books/${book.slug}`}><ArrowLeft size={17} /> Все главы</a>
        <span className="editorial-kicker">{book.title}</span>
        <h1><small>Глава {chapter.chapterNumber}</small>{chapter.title}</h1>
        <div className="reader-rule"><span>✦</span></div>
        <div className="reader-text reader-article-body">
          {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>Текст этой главы готовится к публикации.</p>}
        </div>
      </article>

      <nav className="reader-navigation" aria-label="Навигация по главам">
        {previous ? <a href={`/books/${book.slug}/chapters/${previous.id}`}><ArrowLeft size={18} /><span><small>Предыдущая</small><strong>{previous.title}</strong></span></a> : <span />}
        {next ? <a href={`/books/${book.slug}/chapters/${next.id}`}><span><small>Следующая</small><strong>{next.title}</strong></span><ArrowRight size={18} /></a> : <a href={`/books/${book.slug}`}><span><small>Конец</small><strong>Вернуться к книге</strong></span><BookOpen size={18} /></a>}
      </nav>
    </main>
  );
}
