'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download } from 'lucide-react';

export function BookCompleteness({ book, chapters = [], artworks = [] }) {
  const missing = useMemo(() => [
    !String(book.synopsis || '').trim() && 'нет аннотации',
    !(book.tropes || []).length && 'не добавлены тропы',
    !(book.triggerWarnings || []).length && 'не указаны триггеры',
    book.hasHotScenes == null && 'не указаны горячие сцены',
    !book.worldMap?.url && 'не загружена карта',
    !String(book.dedication || '').trim() && 'забыто посвящение',
    !artworks.length && 'нет фанартов',
    !chapters.length && 'нет глав',
  ].filter(Boolean), [artworks.length, book, chapters.length]);
  return <aside className={`admin-completeness ${missing.length ? 'has-missing' : 'is-complete'}`}><header>{missing.length ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}<div><strong>{missing.length ? `До публикации: ${missing.length}` : 'Карточка заполнена'}</strong><small>Пустые поля читателям не показываются</small></div></header>{missing.length ? <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul> : null}</aside>;
}

export function BackupCenter({ onNotice }) {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/backup', { cache: 'no-store' });
      const data = await response.blob();
      if (!response.ok) throw new Error('Не удалось создать резервную копию.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(data);
      link.download = `booknerd-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      onNotice?.('Резервная копия библиотеки подготовлена.');
    } catch (error) { onNotice?.(error.message, 'error'); } finally { setLoading(false); }
  };
  return <section className="admin-backup-card"><DatabaseBackup size={28} /><div><small>РЕЗЕРВНАЯ КОПИЯ</small><h2>Вся библиотека одним файлом</h2><p>Книги, главы, комментарии, заметки, полки, статистика, карты и журнал команды.</p></div><button type="button" onClick={download} disabled={loading}><Download size={17} /> {loading ? 'Собираем…' : 'Скачать копию'}</button></section>;
}
