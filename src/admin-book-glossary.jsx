'use client';

import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle, Plus, Trash2 } from 'lucide-react';

const blankEntry = {
  id: null,
  category: 'character',
  name: '',
  pronunciation: '',
  description: '',
  connections: '',
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
      onNotice('Укажите название и описание для словаря.', 'error');
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
    <section className="admin-glossary-section">
      <div className="admin-list-head">
        <div><span>05 / СЛОВАРЬ</span><h2>Персонажи и мир книги</h2><p>Укажите, после какой главы можно открыть запись без спойлера.</p></div>
        <button className="admin-secondary" type="button" onClick={() => setDraft(blankEntry)}><Plus size={17} /> Новая запись</button>
      </div>
      <div className="admin-glossary-layout">
        <aside>
          {entries.length ? entries.map((entry) => (
            <button className={draft.id === entry.id ? 'is-active' : ''} type="button" onClick={() => setDraft(entry)} key={entry.id}>
              <span>{entry.category === 'character' ? 'П' : entry.category === 'place' ? 'М' : 'Т'}</span>
              <div><strong>{entry.name}</strong><small>После главы {entry.revealAfterChapter || 'сразу'}</small></div>
            </button>
          )) : <p>Записей пока нет.</p>}
        </aside>
        <div className="admin-glossary-editor">
          <div className="admin-fields two-columns">
            <label><span>Тип</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="character">Персонаж</option><option value="place">Страна или место</option><option value="term">Магический термин</option></select></label>
            <label><span>Название</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Имя или термин" /></label>
            <label><span>Произношение</span><input value={draft.pronunciation} onChange={(event) => setDraft({ ...draft, pronunciation: event.target.value })} placeholder="Например: Лэй-ла" /></label>
            <label><span>Открыть после главы</span><input type="number" min="0" value={draft.revealAfterChapter} onChange={(event) => setDraft({ ...draft, revealAfterChapter: Number(event.target.value || 0) })} /></label>
          </div>
          <label><span>Описание</span><textarea rows="4" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label><span>Связи</span><textarea rows="3" value={draft.connections} onChange={(event) => setDraft({ ...draft, connections: event.target.value })} placeholder="Семья, союзники, страны, важные отношения…" /></label>
          <div>
            {draft.id ? <button className="admin-danger" type="button" onClick={() => remove(draft)}><Trash2 size={16} /> Удалить</button> : null}
            <button className="admin-primary" type="button" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Сохранить запись</button>
          </div>
        </div>
      </div>
    </section>
  );
}
