'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function AdminSeriesOrder({ value = [], onChange }) {
  const items = Array.isArray(value) ? value : [];
  const update = (index, patch) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const add = () => onChange([...items, {
    id: crypto.randomUUID ? crypto.randomUUID() : `series-${Date.now()}`,
    order: items.length + 1,
    title: '',
    kind: 'main',
    translated: false,
    bookSlug: '',
  }]);
  const remove = (index) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

  return (
    <section className="admin-series-editor">
      <header><div><span>Порядок чтения всей серии</span><small>Добавьте даже ещё не переведённые книги и отдельные рассказы.</small></div><button className="admin-secondary" type="button" onClick={add}><Plus size={16} /> Добавить часть</button></header>
      {items.length ? (
        <div>
          {items.map((item, index) => (
            <article key={item.id || index}>
              <input className="admin-series-number" type="number" min="1" value={item.order || index + 1} onChange={(event) => update(index, { order: Number(event.target.value || index + 1) })} aria-label="Порядковый номер" />
              <input value={item.title || ''} onChange={(event) => update(index, { title: event.target.value })} placeholder="Название книги или рассказа" aria-label="Название части серии" />
              <select value={item.kind || 'main'} onChange={(event) => update(index, { kind: event.target.value })} aria-label="Тип части"><option value="main">Основная книга</option><option value="extra">Доп. рассказ</option></select>
              <input value={item.bookSlug || ''} onChange={(event) => update(index, { bookSlug: event.target.value })} placeholder="Адрес страницы, если есть" aria-label="Адрес страницы части" />
              <label className="admin-series-check"><input type="checkbox" checked={Boolean(item.translated)} onChange={(event) => update(index, { translated: event.target.checked })} /><span>Переведено BOOKNERD</span></label>
              <button type="button" onClick={() => remove(index)} aria-label="Удалить часть серии"><Trash2 size={16} /></button>
            </article>
          ))}
        </div>
      ) : <p>Пока используется автоматический порядок по номеру книги в серии.</p>}
    </section>
  );
}
