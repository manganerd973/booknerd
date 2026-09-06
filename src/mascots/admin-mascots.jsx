'use client';

import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';

const PAGE_OPTIONS = [
  ['home', 'Главная'], ['book', 'Страница книги'], ['notifications', 'Уведомления'],
  ['library', 'Закладки'], ['offline', 'Офлайн-книги'], ['profile', 'Профиль'], ['other', 'Другие страницы'],
];
const CATEGORY_OPTIONS = [
  ['greeting', 'Приветствие'], ['returning', 'Возвращение'], ['recommendation', 'Рекомендация'],
  ['new-chapter', 'Новая глава'], ['chapter-ending', 'Завершение главы'], ['search', 'Поиск'],
  ['empty', 'Пустой раздел'], ['offline', 'Офлайн'], ['error', 'Ошибка'], ['achievement', 'Достижение'],
  ['seasonal', 'Сезонная'], ['banter', 'Ссора'], ['flirt', 'Флирт'], ['tip', 'Полезная подсказка'],
];
const FIRST_SPEAKER_OPTIONS = [
  ['ivan', 'Иван', 'Иван первым отвечает на новые вопросы и начинает встроенные сценки.'],
  ['till', 'Тилл', 'Тилл первым отвечает на новые вопросы и начинает встроенные сценки.'],
  ['alternate', 'Менять автоматически', 'Первый говорящий чередуется автоматически.'],
];

const blankDialogue = { id: '', category: 'tip', pages: ['home'], firstSpeaker: 'till', ivanText: '', tillText: '', active: true, startsAt: '', endsAt: '' };

function orderedDraftLines(draft) {
  const byCharacter = {
    ivan: draft.ivanText.trim() ? { character: 'ivan', text: draft.ivanText.trim() } : null,
    till: draft.tillText.trim() ? { character: 'till', text: draft.tillText.trim() } : null,
  };
  const order = draft.firstSpeaker === 'ivan' ? ['ivan', 'till'] : ['till', 'ivan'];
  return order.map((character) => byCharacter[character]).filter(Boolean);
}

async function adminApi(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}

function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AdminMascots({ onNotice }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [config, setConfig] = useState({ enabled: true, aiEnabled: false, disabledPages: [], blockedTopics: [], defaultFirstSpeaker: 'alternate' });
  const [dialogues, setDialogues] = useState([]);
  const [draft, setDraft] = useState(blankDialogue);

  const applyData = (data) => {
    if (data.config) setConfig(data.config);
    if (data.dialogues) setDialogues(data.dialogues);
  };

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    adminApi('/api/admin/mascots')
      .then(applyData)
      .catch((error) => {
        setLoadError(error.message);
        onNotice?.(error.message, 'error');
      })
      .finally(() => setLoading(false));
  }, [onNotice, reloadKey]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const data = await adminApi('/api/admin/mascots', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) });
      applyData(data);
      onNotice?.('Настройки Ивана и Тилла сохранены.');
    } catch (error) { onNotice?.(error.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveDialogue = async (event) => {
    event.preventDefault();
    const lines = orderedDraftLines(draft);
    setSaving(true);
    try {
      const data = await adminApi('/api/admin/mascots', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...draft, lines, startsAt: draft.startsAt || null, endsAt: draft.endsAt || null }),
      });
      applyData(data);
      setDraft(blankDialogue);
      setPreviewOpen(false);
      onNotice?.('Реплика сохранена.');
    } catch (error) { onNotice?.(error.message, 'error'); }
    finally { setSaving(false); }
  };

  const editDialogue = (dialogue) => {
    setDraft({
      id: dialogue.id,
      category: dialogue.category,
      pages: dialogue.pages || ['home'],
      firstSpeaker: dialogue.lines?.find((line) => line.character === 'ivan' || line.character === 'till')?.character || 'till',
      ivanText: dialogue.lines?.find((line) => line.character === 'ivan')?.text || '',
      tillText: dialogue.lines?.find((line) => line.character === 'till')?.text || '',
      active: dialogue.active !== false,
      startsAt: localDate(dialogue.startsAt),
      endsAt: localDate(dialogue.endsAt),
    });
    document.getElementById('admin-mascot-dialogue-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const deleteDialogue = async (dialogue) => {
    if (!window.confirm('Удалить эту реплику?')) return;
    try {
      const data = await adminApi(`/api/admin/mascots?id=${encodeURIComponent(dialogue.id)}`, { method: 'DELETE' });
      applyData(data);
      if (draft.id === dialogue.id) setDraft(blankDialogue);
      onNotice?.('Реплика удалена.');
    } catch (error) { onNotice?.(error.message, 'error'); }
  };

  if (loading) return <section className="admin-content"><div className="admin-loading"><LoaderCircle className="spin" /> Загружаем помощников…</div></section>;

  return (
    <section className="admin-content admin-mascots-page">
      <div className="admin-hero-row">
        <div><span className="admin-kicker">КНИЖНЫЕ ПОМОЩНИКИ</span><h1>Иван<br /><em>и Тилл.</em></h1><p>Управляйте появлениями и репликами. Показы диалогов не записываются в D1.</p></div>
        <div className="admin-mascot-portraits" aria-hidden="true"><img src="/mascots/ivan.webp" alt="" /><img src="/mascots/till.webp" alt="" /></div>
      </div>

      {loadError ? <div className="admin-mascot-error" role="alert"><div><strong>Настройки временно не загрузились</strong><span>{loadError}</span></div><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Повторить</button></div> : null}

      <section className="admin-mascot-config">
        <div><Sparkles size={24} /><span><small>ОБЩИЕ НАСТРОЙКИ</small><h2>Когда помощники доступны</h2></span></div>
        <label className="admin-switch-row"><span><strong>Иван и Тилл включены</strong><small>Можно мгновенно скрыть модуль у всех читателей.</small></span><input type="checkbox" checked={config.enabled} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} /></label>
        <label className="admin-switch-row is-disabled"><span><strong>AI-ответы</strong><small>Сейчас выключены: сайт использует только данные BOOKNERD и готовые безопасные ответы.</small></span><input type="checkbox" checked={false} disabled /></label>
        <fieldset className="admin-mascot-first-speaker">
          <legend>Кто говорит первым</legend>
          <p>Это общая настройка сайта. Читатели не могут её изменять; порядок отдельно созданной сценки сохраняется.</p>
          <div role="radiogroup" aria-label="Кто из помощников говорит первым">
            {FIRST_SPEAKER_OPTIONS.map(([id, label, description]) => (
              <label className={config.defaultFirstSpeaker === id ? 'is-active' : ''} key={id}>
                <input type="radio" name="defaultFirstSpeaker" value={id} checked={config.defaultFirstSpeaker === id} onChange={() => setConfig({ ...config, defaultFirstSpeaker: id })} />
                <span><strong>{label}</strong><small>{description}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset><legend>Не показывать помощников автоматически</legend><div>{PAGE_OPTIONS.map(([id, label]) => <label key={id}><input type="checkbox" checked={config.disabledPages.includes(id)} onChange={(event) => setConfig({ ...config, disabledPages: event.target.checked ? [...config.disabledPages, id] : config.disabledPages.filter((item) => item !== id) })} /> {label}</label>)}</div></fieldset>
        <label><span>Темы, о которых нельзя шутить — каждая с новой строки</span><textarea rows="4" value={(config.blockedTopics || []).join('\n')} onChange={(event) => setConfig({ ...config, blockedTopics: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="Селфхарм&#10;Утрата&#10;Насилие" /></label>
        <button className="admin-primary" type="button" onClick={saveConfig} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Сохранить настройки</button>
      </section>

      <form className="admin-mascot-dialogue-editor" id="admin-mascot-dialogue-editor" onSubmit={saveDialogue}>
        <header><div><span>{draft.id ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ РЕПЛИКА'}</span><h2>{draft.id ? 'Изменить сценку' : 'Добавить сценку'}</h2></div>{draft.id ? <button type="button" onClick={() => setDraft(blankDialogue)}><X size={17} /> Отмена</button> : null}</header>
        <div className="admin-fields two-columns">
          <label><span>Категория</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{CATEGORY_OPTIONS.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
          <label><span>Первый в этой сценке</span><select value={draft.firstSpeaker} onChange={(event) => setDraft({ ...draft, firstSpeaker: event.target.value === 'ivan' ? 'ivan' : 'till' })}><option value="till">Тилл</option><option value="ivan">Иван</option></select><small>Текст останется у своего персонажа; изменится только порядок показа этой сценки.</small></label>
        </div>
        <label className="admin-switch-row"><span><strong>Реплика активна</strong><small>Неактивную можно сохранить как черновик.</small></span><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /></label>
        <fieldset><legend>Где может появляться</legend><div>{PAGE_OPTIONS.map(([id, label]) => <label key={id}><input type="checkbox" checked={draft.pages.includes(id)} onChange={(event) => setDraft({ ...draft, pages: event.target.checked ? [...draft.pages, id] : draft.pages.filter((item) => item !== id) })} /> {label}</label>)}</div></fieldset>
        <div className="admin-mascot-line-fields">
          <label className="is-ivan"><span><img src="/mascots/ivan.webp" alt="" /> Реплика Ивана</span><textarea rows="3" value={draft.ivanText} onChange={(event) => setDraft({ ...draft, ivanText: event.target.value })} maxLength={800} /></label>
          <label className="is-till"><span><img src="/mascots/till.webp" alt="" /> Реплика Тилла</span><textarea rows="3" value={draft.tillText} onChange={(event) => setDraft({ ...draft, tillText: event.target.value })} maxLength={800} /></label>
        </div>
        {previewOpen && (draft.ivanText.trim() || draft.tillText.trim()) ? (
          <div className="admin-mascot-preview" aria-label="Предпросмотр реплики">
            {orderedDraftLines(draft).map((line) => line.character === 'ivan'
              ? <div className="is-ivan" key={line.character}><img src="/mascots/ivan.webp" alt="Иван" /><p><strong>Иван</strong>{line.text}</p></div>
              : <div className="is-till" key={line.character}><p><strong>Тилл</strong>{line.text}</p><img src="/mascots/till.webp" alt="Тилл" /></div>)}
          </div>
        ) : null}
        <div className="admin-fields two-columns">
          <label><span>Начало показа — необязательно</span><input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label>
          <label><span>Окончание показа — необязательно</span><input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label>
        </div>
        <div className="admin-mascot-form-actions">
          <button type="button" onClick={() => setPreviewOpen((value) => !value)} disabled={!draft.ivanText.trim() && !draft.tillText.trim()}><Sparkles size={17} /> {previewOpen ? 'Скрыть предпросмотр' : 'Проверить реплику'}</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : draft.id ? <Save size={17} /> : <Plus size={17} />} {draft.id ? 'Сохранить изменения' : 'Добавить реплику'}</button>
        </div>
      </form>

      <section className="admin-mascot-dialogue-list">
        <header><div><span>ГОТОВЫЕ СЦЕНКИ</span><h2>Реплики редакции</h2></div><strong>{dialogues.length}</strong></header>
        {dialogues.length ? dialogues.map((dialogue) => (
          <article className={dialogue.active ? '' : 'is-inactive'} key={dialogue.id}>
            <button type="button" className="admin-mascot-edit" onClick={() => editDialogue(dialogue)}>
              <small>{CATEGORY_OPTIONS.find(([id]) => id === dialogue.category)?.[1] || dialogue.category} · Первым: {dialogue.lines?.[0]?.character === 'ivan' ? 'Иван' : dialogue.lines?.[0]?.character === 'till' ? 'Тилл' : 'вместе'} · {(dialogue.pages || []).map((id) => PAGE_OPTIONS.find(([key]) => key === id)?.[1] || id).join(', ')}</small>
              {dialogue.lines.map((line, index) => <p key={index}><strong>{line.character === 'ivan' ? 'Иван' : line.character === 'till' ? 'Тилл' : 'Вместе'}:</strong> {line.text}</p>)}
              {!dialogue.active ? <em>Черновик</em> : <span><Check size={14} /> Активна</span>}
            </button>
            <button type="button" className="admin-danger" onClick={() => deleteDialogue(dialogue)} aria-label="Удалить реплику"><Trash2 size={16} /></button>
          </article>
        )) : <div className="admin-empty"><Sparkles size={34} /><h3>Редакционных реплик пока нет</h3><p>Встроенные безопасные сценки продолжат работать.</p></div>}
      </section>
    </section>
  );
}
