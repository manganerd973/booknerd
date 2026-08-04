'use client';

import React, { useEffect, useState } from 'react';
import { Check, Download, LoaderCircle, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'booknerd-offline-books-v1';

function savedBooks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export default function OfflineBookButton({ book, chapters = [] }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { setSaved(Boolean(savedBooks()[book.id])); }, [book.id]);

  const saveOffline = async () => {
    if (!('serviceWorker' in navigator)) {
      setNotice('Офлайн‑режим не поддерживается этим браузером.');
      return;
    }
    setSaving(true);
    setNotice('Сохраняем все опубликованные главы…');
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active || navigator.serviceWorker.controller;
      if (!worker) throw new Error('Перезагрузите страницу и попробуйте ещё раз.');
      const urls = [
        `/books/${book.slug}`,
        ...chapters.map((chapter) => `/books/${book.slug}/chapters/${chapter.id}`),
        book.coverUrl,
      ].filter(Boolean);
      await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = window.setTimeout(() => reject(new Error('Сохранение заняло слишком много времени.')), 90000);
        channel.port1.onmessage = (event) => {
          window.clearTimeout(timer);
          if (event.data?.ok) resolve();
          else reject(new Error(event.data?.error || 'Не удалось сохранить книгу.'));
        };
        worker.postMessage({ type: 'BOOKNERD_SAVE_BOOK', bookId: book.id, urls }, [channel.port2]);
      });
      const current = savedBooks();
      current[book.id] = { title: book.title, slug: book.slug, chapters: chapters.length, savedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      setSaved(true);
      setNotice(`Готово: ${chapters.length} глав доступны без интернета.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="offline-book-control">
      <button type="button" onClick={saveOffline} disabled={saving}>
        {saving ? <LoaderCircle className="spin" size={18} /> : saved ? <RefreshCw size={18} /> : <Download size={18} />}
        {saving ? 'Сохраняем…' : saved ? 'Обновить офлайн‑версию' : 'Скачать для офлайн‑чтения'}
      </button>
      {notice ? <small><Check size={13} /> {notice}</small> : saved ? <small><Check size={13} /> Сохранено на этом устройстве</small> : <small>Книга и все опубликованные главы останутся на устройстве.</small>}
    </div>
  );
}
