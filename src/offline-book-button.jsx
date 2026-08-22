'use client';

import React, { useEffect, useState } from 'react';
import { Check, Download, LoaderCircle, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'booknerd-offline-books-v1';
const SERVICE_WORKER_READY_TIMEOUT = 15000;
const SAVE_INACTIVITY_TIMEOUT = 75000;

function savedBooks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function readyServiceWorker() {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Офлайн‑модуль не запустился. Обновите страницу и попробуйте снова.')), SERVICE_WORKER_READY_TIMEOUT);
    navigator.serviceWorker.ready.then((registration) => {
      window.clearTimeout(timer);
      resolve(registration);
    }, (error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
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
    if (!navigator.onLine) {
      setNotice('Для первого сохранения книги подключитесь к интернету.');
      return;
    }
    setSaving(true);
    setNotice('Сохраняем все опубликованные главы…');
    try {
      const registration = await readyServiceWorker();
      const worker = registration.active || navigator.serviceWorker.controller;
      if (!worker) throw new Error('Перезагрузите страницу и попробуйте ещё раз.');
      const urls = [
        `/books/${book.slug}`,
        ...chapters.map((chapter) => `/books/${book.slug}/chapters/${chapter.id}`),
        book.coverUrl,
      ].filter(Boolean);
      const result = await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        let timer = 0;
        const finish = (callback, value) => {
          window.clearTimeout(timer);
          channel.port1.close();
          callback(value);
        };
        const armTimeout = () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => finish(reject, new Error('Загрузка остановилась. Проверьте соединение и повторите сохранение.')), SAVE_INACTIVITY_TIMEOUT);
        };
        armTimeout();
        channel.port1.onmessage = (event) => {
          if (event.data?.type === 'progress') {
            armTimeout();
            setNotice(`Сохраняем ${event.data.completed} из ${event.data.total}…`);
            return;
          }
          if (event.data?.ok) finish(resolve, event.data);
          else finish(reject, new Error(event.data?.error || 'Не удалось сохранить книгу.'));
        };
        worker.postMessage({ type: 'BOOKNERD_SAVE_BOOK', bookId: book.id, urls }, [channel.port2]);
      });
      const current = savedBooks();
      current[book.id] = { title: book.title, slug: book.slug, chapters: chapters.length, savedResources: result.saved, savedAt: new Date().toISOString() };
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
