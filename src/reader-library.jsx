'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookOpen, Check, Heart, LoaderCircle, XCircle } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';

export const LIBRARY_STATUS = {
  saved: { label: 'В планах', short: 'В планах' },
  reading: { label: 'Читаю', short: 'Читаю' },
  finished: { label: 'Прочитано', short: 'Прочитано' },
  favorite: { label: 'Любимые', short: 'Любимые' },
  dropped: { label: 'Брошено', short: 'Брошено' },
};

function announceLibraryChange(item) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('booknerd-library-change', { detail: item }));
  }
}

export async function loadReaderLibrary() {
  const visitorKey = getVisitorKey();
  const response = await fetch(`/api/library?visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Не удалось открыть личную библиотеку.');
  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function updateReaderLibrary({ bookId, status = 'saved', lastChapterId = null, lastPage = 0, progress = 0, preserveFinished = false }) {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorKey: getVisitorKey(), bookId, status, lastChapterId, lastPage, progress, preserveFinished }),
    keepalive: true,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось обновить личную библиотеку.');
  announceLibraryChange(data.item);
  return data.item;
}

export async function removeReaderLibraryBook(bookId) {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorKey: getVisitorKey(), bookId, action: 'remove' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось убрать книгу.');
  announceLibraryChange({ bookId, status: null });
}

export default function BookLibraryControl({ bookId }) {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    loadReaderLibrary()
      .then((items) => {
        if (active) setStatus(items.find((item) => item.bookId === bookId)?.status || '');
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bookId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const options = useMemo(() => Object.entries(LIBRARY_STATUS), []);
  const StatusIcon = status === 'finished' ? Check : status === 'reading' ? BookOpen : status === 'favorite' ? Heart : status === 'dropped' ? XCircle : Bookmark;

  const chooseStatus = async (nextStatus) => {
    setLoading(true);
    try {
      const item = await updateReaderLibrary({ bookId, status: nextStatus, progress: nextStatus === 'finished' ? 100 : 0 });
      setStatus(item.status);
      setNotice(`Книга добавлена: ${LIBRARY_STATUS[item.status].label.toLowerCase()}.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      await removeReaderLibraryBook(bookId);
      setStatus('');
      setNotice('Книга убрана из вашей библиотеки.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="book-library-control">
      <div className="book-library-control-title">
        {loading ? <LoaderCircle className="spin" size={18} /> : <StatusIcon size={18} />}
        <span><small>Моя библиотека</small><strong>{status ? LIBRARY_STATUS[status].label : 'Добавить книгу'}</strong></span>
      </div>
      <div className="book-library-statuses">
        {options.map(([value, option]) => (
          <button type="button" className={status === value ? 'is-active' : ''} onClick={() => chooseStatus(value)} disabled={loading} key={value}>
            {value === 'finished' && status === value ? <Check size={14} /> : null}{option.short}
          </button>
        ))}
        {status ? <button type="button" className="is-remove" onClick={remove} disabled={loading}>Убрать</button> : null}
      </div>
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  );
}
