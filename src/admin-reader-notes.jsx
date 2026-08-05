'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, EyeOff, LoaderCircle, Pin, Quote, RefreshCw, Trash2 } from 'lucide-react';

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}

function noteStatus(note) {
  if (note.isPinned) return 'Закреплена';
  if (note.status === 'approved') return 'Одобрена';
  if (note.status === 'hidden') return 'Скрыта';
  return 'Ждёт решения';
}

export default function AdminReaderNotes({ onNotice }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/api/admin/reader-notes', { cache: 'no-store' });
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    pending: notes.filter((note) => note.status === 'pending').length,
    approved: notes.filter((note) => note.status === 'approved').length,
    pinned: notes.filter((note) => note.isPinned).length,
  }), [notes]);

  const change = async (note, payload, successMessage) => {
    setWorkingId(note.id);
    try {
      await request(`/api/admin/reader-notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await load();
      onNotice(successMessage);
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setWorkingId('');
    }
  };

  const remove = async (note) => {
    if (!window.confirm('Удалить эту публичную заметку? Личная копия у читателя останется на его устройстве.')) return;
    setWorkingId(note.id);
    try {
      await request(`/api/admin/reader-notes/${note.id}`, { method: 'DELETE' });
      setNotes((current) => current.filter((item) => item.id !== note.id));
      onNotice('Публичная заметка удалена.');
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <section className="admin-content admin-reader-notes-page">
      <div className="admin-hero-row">
        <div><span className="admin-kicker">ГОЛОС ЧИТАТЕЛЕЙ</span><h1>Цитата<br /><em>дня.</em></h1><p>На главную попадают только заметки, которые читатели сами предложили и редакция одобрила. Одобренные заметки меняются раз в сутки.</p></div>
        <button className="admin-secondary" type="button" onClick={load}><RefreshCw size={18} /> Обновить</button>
      </div>
      <div className="admin-comment-summary">
        <article><strong>{stats.pending}</strong><span>ждут решения</span></article>
        <article><strong>{stats.approved}</strong><span>в ежедневном выборе</span></article>
        <article><strong>{stats.pinned}</strong><span>закреплено сейчас</span></article>
      </div>

      {loading ? (
        <div className="admin-loading"><LoaderCircle className="spin" /> Загружаем заметки…</div>
      ) : notes.length ? (
        <div className="admin-reader-note-list">
          {notes.map((note) => (
            <article className={`admin-reader-note-card is-${note.status} ${note.isPinned ? 'is-pinned' : ''}`} key={note.id}>
              <div className="admin-reader-note-meta">
                <span>{noteStatus(note)}</span>
                {note.isSpoiler ? <b>Спойлер — не показывать</b> : null}
                <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleDateString('ru-RU')}</time>
              </div>
              <Quote size={24} />
              <blockquote>«{note.quote}»</blockquote>
              {note.note ? <p>{note.note}</p> : null}
              <div className="admin-reader-note-source">
                <BookOpen size={15} />
                <a href={`/books/${note.bookSlug}/chapters/${note.chapterId}?page=${note.page + 1}`} target="_blank" rel="noreferrer">{note.bookTitle}{note.chapterTitle ? ` · ${note.chapterTitle}` : ''}</a>
                <span>{note.authorName}</span>
              </div>
              <div className="admin-reader-note-actions">
                {note.status !== 'approved' && !note.isSpoiler ? <button type="button" onClick={() => change(note, { status: 'approved' }, 'Заметка добавлена в ежедневный выбор.')} disabled={workingId === note.id}><Check size={16} /> Одобрить</button> : null}
                {note.status === 'approved' && !note.isPinned ? <button type="button" onClick={() => change(note, { isPinned: true }, 'Эта заметка закреплена на главной.')} disabled={workingId === note.id}><Pin size={16} /> Закрепить</button> : null}
                {note.isPinned ? <button type="button" onClick={() => change(note, { isPinned: false }, 'Закрепление снято — снова работает ежедневный выбор.')} disabled={workingId === note.id}><Pin size={16} /> Снять закрепление</button> : null}
                {note.status !== 'hidden' ? <button type="button" onClick={() => change(note, { status: 'hidden' }, 'Заметка скрыта.')} disabled={workingId === note.id}><EyeOff size={16} /> Скрыть</button> : null}
                <button className="is-danger" type="button" onClick={() => remove(note)} disabled={workingId === note.id}><Trash2 size={16} /> Удалить</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty"><Quote size={42} /><h3>Предложений пока нет</h3><p>Они появятся здесь, когда читатель отметит свою заметку как публичную.</p></div>
      )}
    </section>
  );
}
