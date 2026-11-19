'use client';
import React, { useEffect, useRef, useState } from 'react';
import { loadReaderLibrary } from './reader-library.jsx';
export default function ContinueReadingDialog({ onClose }) {
  const ref = useRef(null);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    ref.current?.showModal(); let active = true; let recent = null;
    try { recent = JSON.parse(localStorage.getItem('booknerd-last-reading-v1') || 'null'); } catch {}
    if (recent?.bookSlug && recent?.lastChapterId) setItem(recent);
    loadReaderLibrary().then(items => {
      if (!active) return;
      const candidates = [...items.filter(entry => entry.bookSlug && entry.lastChapterId), ...(recent?.bookSlug && recent?.lastChapterId ? [recent] : [])];
      candidates.sort((a,b) => String(b.lastOpenedAt || '').localeCompare(String(a.lastOpenedAt || '')));
      setItem(candidates[0] || null);
    }).catch(() => { if (active && !recent) setError('Не удалось загрузить историю. Закройте окно и попробуйте ещё раз.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const href = item ? `/books/${encodeURIComponent(item.bookSlug)}/chapters/${encodeURIComponent(item.lastChapterId)}?page=${Math.max(0,Number(item.lastPage)||0)+1}` : '';
  return <dialog className="resume-reading-dialog" ref={ref} onCancel={onClose} onClose={onClose} onClick={event => { if(event.target === event.currentTarget) onClose(); }} aria-labelledby="resume-reading-title">
    <header><h2 id="resume-reading-title">Продолжить чтение</h2><button onClick={onClose} aria-label="Закрыть">×</button></header>
    {item ? <a className="resume-reading-book" href={href}>{item.coverUrl && <img src={item.coverUrl} alt="" />}<span><strong>{item.bookTitle}</strong><small>Глава {item.chapterNumber}{item.chapterTitle ? ` · ${item.chapterTitle}` : ''}</small><b>Продолжить с сохранённого места →</b></span></a> : <p role="status">{loading ? 'Ищем последнюю книгу…' : error || 'Вы ещё не начинали читать. Выберите книгу в каталоге.'}</p>}
    <nav><a href="/library">Мои закладки</a><a href="/translations">Найти книгу</a></nav>
  </dialog>;
}
