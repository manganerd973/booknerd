'use client';

import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle, Plus, Trash2 } from 'lucide-react';

const blankEntry = {
  id: null,
  category: 'term',
  name: '',
  description: '',
  revealAfterChapter: 0,
  sortOrder: 0,
};

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось сохранить словарь.');
  return data;
}

export default function AdminBookGlossary({ bookId, onNotice }) {
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState(blankEntry);
  const [saving, setSaving] = useState(false);

  const reload = () => api(`/api/admin/books/${bookId}/glossary`).then((data) => setEntries(data.entries || [])).catch((error) => onNotice(error.message, 'error'));
  useEffect(() => { if (bookId) reload(); }, [bookId]);

  const save = async () => {
    if (!draft.name.trim() || !draft.description.trim()) {
      onNotice('Напишите слово и его значение.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/books/${bookId}/glossary`, {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      setDraft(blankEntry);
      await reload();
      onNotice('Запись словаря сохранена.');
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Удалить «${entry.name}» из словаря?`)) return;
    try {
      await api(`/api/admin/books/${bookId}/glossary?entryId=${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
      await reload();
      if (draft.id === entry.id) setDraft(blankEntry);
    } catch (error) {
      onNotice(error.message, 'error');
    }
  };

  return (
    <section className="admin-glossary-section" id="admin-book-glossary">
      <div className="admin-list-head">
        <div><span>05 / СЛОВАРЬ</span><h2>Слова и их значения</h2><p>Напишите слово из книги и простое объяснение. При необходимости укажите главу, после которой его можно показать без спойлера.</p></div>
        <button className="admin-secondary" type="button" onClick={() => setDraft(blankEntry)}><Plus size={17} /> Добавить слово</button>
      </div>
      <div className="admin-glossary-layout">
        <aside>
          {entries.length ? entries.map((entry) => (
            <button className={draft.id === entry.id ? 'is-active' : ''} type="button" onClick={() => setDraft({ ...entry, category: 'term' })} key={entry.id}>
              <span>С</span>
              <div><strong>{entry.name}</strong><small>После главы {entry.revealAfterChapter || 'сразу'}</small></div>
            </button>
          )) : <p>Записей пока нет.</p>}
        </aside>
        <div className="admin-glossary-editor">
          <div className="admin-fields two-columns">
            <label><span>Слово</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, category: 'term' })} placeholder="Например: арканум" /></label>
            <label><span>Открыть после главы</span><input type="number" min="0" value={draft.revealAfterChapter} onChange={(event) => setDraft({ ...draft, revealAfterChapter: Number(event.target.value || 0) })} /></label>
          </div>
          <label><span>Значение</span><textarea rows="5" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value, category: 'term' })} placeholder="Что означает это слово в книге?" /></label>
          <div>
            {draft.id ? <button className="admin-danger" type="button" onClick={() => remove(draft)}><Trash2 size={16} /> Удалить</button> : null}
            <button className="admin-primary" type="button" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Сохранить запись</button>
          </div>
        </div>
      </div>
    </section>
  );
}
