'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, GripVertical, LoaderCircle, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import MascotSprite from './mascot-sprite.jsx';
import {
  MASCOT_AFTER_ACTIONS, MASCOT_GAZES, MASCOT_PLACEMENTS, MASCOT_POSES,
  defaultListenerReaction, emotionOptions, newMascotLine, normalizeMascotLines,
} from './mascot-emotions.js';
import { duplicateDraftLine, moveDraftLine, orderedDraftLines } from './admin-dialogue-order.js';

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

function createBlankDialogue() {
  return { id: '', category: 'tip', pages: ['home'], lines: [newMascotLine('till', 'tip', 0)], active: true, startsAt: '', endsAt: '' };
}

const newReaderWelcomeTemplate = {
  ...createBlankDialogue(), category: 'greeting', pages: ['home'],
  lines: normalizeMascotLines([
    { character: 'till', text: 'О, новый читатель! Мне сразу показать Вам лучшие книги?', expression: 'excited', listenerReaction: 'soft-smile', gaze: 'at-reader', delayMs: 500 },
    { character: 'ivan', text: 'Сначала позволь человеку осмотреться.', expression: 'focused', listenerReaction: 'neutral', gaze: 'at-other', delayMs: 350 },
    { character: 'till', text: 'Я не мешаю. Я создаю гостеприимную атмосферу.', expression: 'proud', listenerReaction: 'amused', gaze: 'at-reader', delayMs: 350 },
    { character: 'ivan', text: 'Очень громкую гостеприимную атмосферу.', expression: 'quiet-laugh', listenerReaction: 'caught', gaze: 'at-other', delayMs: 350, afterAction: 'neutral' },
  ], { category: 'greeting' }),
};

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

function ScenePreview({ draft, onClose }) {
  const lines = useMemo(() => orderedDraftLines(draft), [draft]);
  const [index, setIndex] = useState(0);
  const closeButtonRef = useRef(null);
  const line = lines[index] || null;
  const ivanExpression = line?.character === 'ivan' ? line.expression : line?.character === 'till' ? line.listenerReaction : 'neutral';
  const tillExpression = line?.character === 'till' ? line.expression : line?.character === 'ivan' ? line.listenerReaction : 'neutral';

  useEffect(() => { closeButtonRef.current?.focus(); }, []);
  useEffect(() => {
    if (!line || index >= lines.length - 1) return undefined;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), line.delayMs + line.durationMs);
    return () => window.clearTimeout(timer);
  }, [index, line, lines.length]);

  return (
    <div className="admin-mascot-preview-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-mascot-scene-preview" role="dialog" aria-modal="true" aria-label="Предпросмотр всей сценки">
        <header><div><small>ПРЕДПРОСМОТР</small><h2>Сценка целиком</h2></div><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Закрыть предпросмотр"><X size={19} /></button></header>
        <div className="admin-mascot-preview-stage">
          <MascotSprite character="ivan" expression={ivanExpression} pose={line?.character === 'ivan' ? line.pose : 'natural'} gaze={line?.character === 'ivan' ? line.gaze : 'at-other'} eager />
          <div className={`admin-mascot-preview-bubble is-${line?.character || 'ivan'}`} aria-live="polite"><strong>{line?.character === 'till' ? 'Тилл' : 'Иван'}</strong><p>{line?.text || 'Добавьте текст реплики.'}</p><small>{index + 1} из {lines.length}</small></div>
          <MascotSprite character="till" expression={tillExpression} pose={line?.character === 'till' ? line.pose : 'natural'} gaze={line?.character === 'till' ? line.gaze : 'at-other'} eager />
        </div>
        <footer><button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>Предыдущая</button><button type="button" onClick={() => setIndex((value) => Math.min(lines.length - 1, value + 1))} disabled={index >= lines.length - 1}>Следующая</button><button className="admin-primary" type="button" onClick={() => setIndex(0)}>Сначала</button></footer>
      </section>
    </div>
  );
}

function DialogueLineEditor({ line, index, total, category, onChange, onMove, onDuplicate, onDelete, onDragStart, onDrop }) {
  const listener = line.character === 'ivan' ? 'till' : 'ivan';
  const changeCharacter = (character) => {
    const expression = emotionOptions(character)[0].id;
    onChange({ ...line, character, expression, listenerReaction: defaultListenerReaction(character, expression) });
  };
  return (
    <article className={`admin-mascot-line-card is-${line.character}`} draggable onDragStart={() => onDragStart(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(index)}>
      <header><span className="admin-mascot-drag" title="Перетащите реплику"><GripVertical size={18} /><b>{index + 1}</b></span><strong>{line.character === 'ivan' ? 'Иван' : 'Тилл'} говорит {index === 0 ? 'первым' : `${index + 1}-м`}</strong><div><button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label="Поднять реплику"><ArrowUp size={15} /></button><button type="button" onClick={() => onMove(index, index + 1)} disabled={index === total - 1} aria-label="Опустить реплику"><ArrowDown size={15} /></button><button type="button" onClick={() => onDuplicate(index)} disabled={total >= 12} aria-label="Дублировать реплику"><Copy size={15} /></button><button type="button" onClick={() => onDelete(index)} disabled={total <= 1} aria-label="Удалить реплику"><Trash2 size={15} /></button></div></header>
      <div className="admin-mascot-line-layout">
        <div className="admin-mascot-expression-preview"><MascotSprite character={line.character} expression={line.expression} pose={line.pose} gaze={line.gaze} eager /><small>{emotionOptions(line.character).find((item) => item.id === line.expression)?.label || line.expression}</small></div>
        <div className="admin-mascot-line-controls">
          <div className="admin-fields two-columns"><label><span>Кто говорит</span><select value={line.character} onChange={(event) => changeCharacter(event.target.value)}><option value="ivan">Иван</option><option value="till">Тилл</option></select></label><label><span>Выражение</span><select value={line.expression} onChange={(event) => onChange({ ...line, expression: event.target.value, listenerReaction: defaultListenerReaction(line.character, event.target.value) })}>{emotionOptions(line.character).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
          <label><span>Текст реплики</span><textarea rows="3" maxLength={800} value={line.text} onChange={(event) => onChange({ ...line, text: event.target.value })} placeholder="Введите реплику…" /></label>
          <div className="admin-fields three-columns"><label><span>Поза</span><select value={line.pose} onChange={(event) => onChange({ ...line, pose: event.target.value })}>{MASCOT_POSES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label><span>Взгляд</span><select value={line.gaze} onChange={(event) => onChange({ ...line, gaze: event.target.value })}>{MASCOT_GAZES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label><span>Реакция {listener === 'ivan' ? 'Ивана' : 'Тилла'}</span><select value={line.listenerReaction} onChange={(event) => onChange({ ...line, listenerReaction: event.target.value })}>{emotionOptions(listener).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
          <div className="admin-fields three-columns"><label><span>Задержка, мс</span><input type="number" min="0" max="10000" step="50" value={line.delayMs} onChange={(event) => onChange({ ...line, delayMs: event.target.value })} /></label><label><span>Показ, мс</span><input type="number" min="900" max="15000" step="100" value={line.durationMs} onChange={(event) => onChange({ ...line, durationMs: event.target.value })} /></label><label><span>Место</span><select value={line.placement} onChange={(event) => onChange({ ...line, placement: event.target.value })}>{MASCOT_PLACEMENTS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
          <label><span>После реплики</span><select value={line.afterAction} onChange={(event) => onChange({ ...line, afterAction: event.target.value })}>{MASCOT_AFTER_ACTIONS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        </div>
      </div>
    </article>
  );
}

export default function AdminMascots({ onNotice }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(-1);
  const [config, setConfig] = useState({ enabled: true, aiEnabled: true, disabledPages: [], blockedTopics: [] });
  const [dialogues, setDialogues] = useState([]);
  const [draft, setDraft] = useState(createBlankDialogue);

  const applyData = (data) => { if (data.config) setConfig(data.config); if (data.dialogues) setDialogues(data.dialogues); };
  useEffect(() => { setLoading(true); setLoadError(''); adminApi('/api/admin/mascots').then(applyData).catch((error) => { setLoadError(error.message); onNotice?.(error.message, 'error'); }).finally(() => setLoading(false)); }, [onNotice, reloadKey]);

  const saveConfig = async () => { setSaving(true); try { const data = await adminApi('/api/admin/mascots', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) }); applyData(data); onNotice?.('Настройки Ивана и Тилла сохранены.'); } catch (error) { onNotice?.(error.message, 'error'); } finally { setSaving(false); } };
  const saveDialogue = async (event) => { event.preventDefault(); const lines = orderedDraftLines(draft); if (!lines.length) return onNotice?.('Добавьте хотя бы одну заполненную реплику.', 'error'); setSaving(true); try { const data = await adminApi('/api/admin/mascots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft, lines, startsAt: draft.startsAt || null, endsAt: draft.endsAt || null }) }); applyData(data); setDraft(createBlankDialogue()); setPreviewOpen(false); onNotice?.('Сценка сохранена в выбранном порядке.'); } catch (error) { onNotice?.(error.message, 'error'); } finally { setSaving(false); } };
  const editDialogue = (dialogue) => { setDraft({ id: dialogue.id, category: dialogue.category, pages: dialogue.pages || ['home'], lines: normalizeMascotLines(dialogue.lines, { category: dialogue.category }), active: dialogue.active !== false, startsAt: localDate(dialogue.startsAt), endsAt: localDate(dialogue.endsAt) }); document.getElementById('admin-mascot-dialogue-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const deleteDialogue = async (dialogue) => { if (!window.confirm('Удалить эту сценку?')) return; try { const data = await adminApi(`/api/admin/mascots?id=${encodeURIComponent(dialogue.id)}`, { method: 'DELETE' }); applyData(data); if (draft.id === dialogue.id) setDraft(createBlankDialogue()); onNotice?.('Сценка удалена.'); } catch (error) { onNotice?.(error.message, 'error'); } };
  const updateLine = (index, next) => setDraft((value) => ({ ...value, lines: value.lines.map((line, lineIndex) => lineIndex === index ? next : line) }));
  const moveLine = (from, to) => setDraft((value) => ({ ...value, lines: moveDraftLine(value.lines, from, to) }));

  if (loading) return <section className="admin-content"><div className="admin-loading"><LoaderCircle className="spin" /> Загружаем помощников…</div></section>;
  return (
    <section className="admin-content admin-mascots-page">
      <div className="admin-hero-row"><div><span className="admin-kicker">КНИЖНЫЕ ПОМОЩНИКИ</span><h1>Иван<br /><em>и Тилл.</em></h1><p>Каждая сценка имеет собственный порядок, эмоции и реакции. Показы не записываются в D1.</p></div><div className="admin-mascot-portraits" aria-hidden="true"><MascotSprite character="ivan" expression="soft-smile" decorative /><MascotSprite character="till" expression="excited" decorative /></div></div>
      {loadError ? <div className="admin-mascot-error" role="alert"><div><strong>Настройки временно не загрузились</strong><span>{loadError}</span></div><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Повторить</button></div> : null}
      <section className="admin-mascot-config"><div><Sparkles size={24} /><span><small>ОБЩИЕ НАСТРОЙКИ</small><h2>Когда помощники доступны</h2></span></div><label className="admin-switch-row"><span><strong>Иван и Тилл включены</strong><small>Можно мгновенно скрыть модуль у всех читателей.</small></span><input type="checkbox" checked={config.enabled} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} /></label><label className="admin-switch-row"><span><strong>AI-ответы</strong><small>AI вызывается только после вопроса читателя и использует утверждённые эмоции.</small></span><input type="checkbox" checked={config.aiEnabled} onChange={(event) => setConfig({ ...config, aiEnabled: event.target.checked })} /></label><fieldset><legend>Не показывать помощников автоматически</legend><div>{PAGE_OPTIONS.map(([id, label]) => <label key={id}><input type="checkbox" checked={config.disabledPages.includes(id)} onChange={(event) => setConfig({ ...config, disabledPages: event.target.checked ? [...config.disabledPages, id] : config.disabledPages.filter((item) => item !== id) })} /> {label}</label>)}</div></fieldset><label><span>Темы, о которых нельзя шутить — каждая с новой строки</span><textarea rows="4" value={(config.blockedTopics || []).join('\n')} onChange={(event) => setConfig({ ...config, blockedTopics: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label><button className="admin-primary" type="button" onClick={saveConfig} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Сохранить настройки</button></section>
      <form className="admin-mascot-dialogue-editor" id="admin-mascot-dialogue-editor" onSubmit={saveDialogue}>
        <header><div><span>{draft.id ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ СЦЕНКА'}</span><h2>{draft.id ? 'Изменить сценку' : 'Собрать диалог'}</h2><p>Первая карточка говорит первой. Перетащите карточки в любой порядок.</p></div><div className="admin-mascot-editor-actions">{!draft.id ? <button type="button" onClick={() => setDraft({ ...newReaderWelcomeTemplate, lines: newReaderWelcomeTemplate.lines.map((line) => ({ ...line })) })}><Sparkles size={17} /> Приветствие нового читателя</button> : null}{draft.id ? <button type="button" onClick={() => setDraft(createBlankDialogue())}><X size={17} /> Отмена</button> : null}</div></header>
        <div className="admin-fields two-columns"><label><span>Категория</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{CATEGORY_OPTIONS.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><label className="admin-switch-row"><span><strong>Сценка активна</strong><small>Неактивную можно сохранить как черновик.</small></span><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /></label></div>
        <fieldset><legend>Где может появляться</legend><div>{PAGE_OPTIONS.map(([id, label]) => <label key={id}><input type="checkbox" checked={draft.pages.includes(id)} onChange={(event) => setDraft({ ...draft, pages: event.target.checked ? [...draft.pages, id] : draft.pages.filter((item) => item !== id) })} /> {label}</label>)}</div></fieldset>
        <div className="admin-mascot-sequence">{draft.lines.map((line, index) => <DialogueLineEditor key={line.id || index} line={line} index={index} total={draft.lines.length} category={draft.category} onChange={(next) => updateLine(index, next)} onMove={moveLine} onDuplicate={(lineIndex) => setDraft((value) => ({ ...value, lines: duplicateDraftLine(value.lines, lineIndex, value.category) }))} onDelete={(lineIndex) => setDraft((value) => ({ ...value, lines: value.lines.filter((_, current) => current !== lineIndex) }))} onDragStart={setDragIndex} onDrop={(to) => { if (dragIndex >= 0) moveLine(dragIndex, to); setDragIndex(-1); }} />)}</div>
        <button className="admin-mascot-add-line" type="button" disabled={draft.lines.length >= 12} onClick={() => setDraft((value) => ({ ...value, lines: [...value.lines, newMascotLine(value.lines.at(-1)?.character === 'till' ? 'ivan' : 'till', value.category, value.lines.length)] }))}><Plus size={17} /> Добавить следующую реплику</button>
        <div className="admin-fields two-columns"><label><span>Начало показа — необязательно</span><input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label><label><span>Окончание показа — необязательно</span><input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label></div>
        <div className="admin-mascot-form-actions"><button type="button" onClick={() => setPreviewOpen(true)} disabled={!draft.lines.some((line) => line.text.trim())}><Sparkles size={17} /> Предпросмотр всей сценки</button><button className="admin-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : draft.id ? <Save size={17} /> : <Plus size={17} />} {draft.id ? 'Сохранить изменения' : 'Добавить сценку'}</button></div>
      </form>
      <section className="admin-mascot-dialogue-list"><header><div><span>ГОТОВЫЕ СЦЕНКИ</span><h2>Диалоги редакции</h2></div><strong>{dialogues.length}</strong></header>{dialogues.length ? dialogues.map((dialogue) => <article className={dialogue.active ? '' : 'is-inactive'} key={dialogue.id}><button type="button" className="admin-mascot-edit" onClick={() => editDialogue(dialogue)}><small>{CATEGORY_OPTIONS.find(([id]) => id === dialogue.category)?.[1] || dialogue.category} · Порядок: {(dialogue.lines || []).map((line) => line.character === 'ivan' ? 'И' : 'Т').join(' → ')} · {(dialogue.pages || []).map((id) => PAGE_OPTIONS.find(([key]) => key === id)?.[1] || id).join(', ')}</small>{(dialogue.lines || []).map((line, index) => <p key={`${line.id || index}`}><strong>{line.character === 'ivan' ? 'Иван' : 'Тилл'} · {line.expression || 'neutral'}:</strong> {line.text}</p>)}{!dialogue.active ? <em>Черновик</em> : <span><Check size={14} /> Активна</span>}</button><button type="button" className="admin-danger" onClick={() => deleteDialogue(dialogue)} aria-label="Удалить сценку"><Trash2 size={16} /></button></article>) : <div className="admin-empty"><Sparkles size={34} /><h3>Редакционных сценок пока нет</h3><p>Встроенные безопасные сценки продолжат работать.</p></div>}</section>
      {previewOpen ? <ScenePreview draft={draft} onClose={() => setPreviewOpen(false)} /> : null}
    </section>
  );
}
