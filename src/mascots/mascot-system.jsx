'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eraser, Minus, Send, Settings, X } from 'lucide-react';
import {
  BUILTIN_DIALOGUES,
  DEFAULT_MASCOT_SETTINGS,
  MASCOT_HISTORY_KEY,
  MASCOT_MODE_PREVIEWS,
  MASCOT_QUICK_QUESTIONS,
  OFFLINE_DIALOGUE,
  loadMascotSettings,
  mascotBookSlug,
  mascotPageContext,
  normalizeMascotSettings,
} from './mascot-config.js';
import { openingDialogue, resolveFirstSpeaker, selectDialogueByFirstSpeaker } from './mascot-dialogue-engine.js';
import { getVisitorKey } from '../site-analytics.js';

const CONFIG_SESSION_KEY = 'booknerd-mascot-config-v43';
const LAST_AUTO_KEY = 'booknerd-mascot-last-auto-v1';
const MAX_HISTORY = 24;
const AUTO_PAGE_CONTEXTS = new Set(['home', 'book', 'notifications', 'library', 'profile', 'offline', 'other']);
const TIP_CATEGORIES = new Set(['tip', 'recommendation', 'new-chapter', 'offline', 'error']);

function normalizeSystemConfig(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: source.enabled !== false,
    aiEnabled: source.aiEnabled === true,
    disabledPages: Array.isArray(source.disabledPages) ? source.disabledPages : [],
    blockedTopics: Array.isArray(source.blockedTopics) ? source.blockedTopics : [],
    dialogues: Array.isArray(source.dialogues) ? source.dialogues : [],
    defaultFirstSpeaker: ['ivan', 'till', 'alternate'].includes(source.defaultFirstSpeaker) ? source.defaultFirstSpeaker : 'alternate',
  };
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(MASCOT_HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try { localStorage.setItem(MASCOT_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY))); } catch { /* local history is optional */ }
}

function normalizeMessages(lines = []) {
  return lines.map((line, index) => ({
    id: line.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    character: ['ivan', 'till', 'reader', 'both'].includes(line.character) ? line.character : 'ivan',
    text: String(line.text || '').trim(),
  })).filter((line) => line.text);
}

function CharacterPortrait({ character, compact = false }) {
  return <img className={`mascot-character-image is-${character}${compact ? ' is-compact' : ''}`} src={`/mascots/${character}.webp`} alt={character === 'ivan' ? 'Иван' : 'Тилл'} loading="lazy" decoding="async" />;
}

function DialogueMessages({ messages }) {
  return (
    <div className="mascot-chat-messages" aria-live="polite">
      {messages.map((message) => (
        <article className={`mascot-message is-${message.character}`} key={message.id}>
          {message.character === 'ivan' || message.character === 'till' ? <CharacterPortrait character={message.character} compact /> : null}
          <div>
            {message.character !== 'reader' ? <strong>{message.character === 'both' ? 'Иван и Тилл' : message.character === 'ivan' ? 'Иван' : 'Тилл'}</strong> : null}
            <p>{message.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function MascotSystem() {
  const [ready, setReady] = useState(false);
  const [pathname, setPathname] = useState('');
  const [settings, setSettings] = useState(DEFAULT_MASCOT_SETTINGS);
  const [systemConfig, setSystemConfig] = useState({ enabled: true, aiEnabled: false, disabledPages: [], dialogues: [], defaultFirstSpeaker: 'alternate' });
  const [open, setOpen] = useState(false);
  const [edgeDialogue, setEdgeDialogue] = useState(null);
  const [edgeLineIndex, setEdgeLineIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [askMode, setAskMode] = useState('both');
  const [sending, setSending] = useState(false);
  const [pendingSpoilerQuestion, setPendingSpoilerQuestion] = useState('');
  const [manualContext, setManualContext] = useState(null);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const swipeStart = useRef(null);
  const settingsRef = useRef(DEFAULT_MASCOT_SETTINGS);
  const previousPathRef = useRef('');

  const pageContext = mascotPageContext(pathname);
  const hiddenByPage = pageContext === 'hidden' || systemConfig.disabledPages.includes(pageContext);
  const globallyHidden = !systemConfig.enabled || settings.mode === 'hidden';
  const readerHidden = pageContext === 'reader' && settings.quietReading;
  const bookSlug = manualContext?.bookSlug || mascotBookSlug(pathname);
  const currentChapter = Number(manualContext?.currentChapter || 0);
  const effectiveFirstSpeaker = useMemo(
    () => resolveFirstSpeaker(systemConfig.defaultFirstSpeaker),
    [systemConfig.defaultFirstSpeaker],
  );

  useEffect(() => {
    const initialSettings = loadMascotSettings();
    settingsRef.current = initialSettings;
    setPathname(`${window.location.pathname}${window.location.search}`);
    setSettings(initialSettings);
    setHistory(readHistory());
    setReady(true);

    const showModePreview = (mode) => {
      if (mode === 'hidden') {
        setOpen(false);
        setEdgeDialogue(null);
        return;
      }
      const preview = MASCOT_MODE_PREVIEWS[mode] || MASCOT_MODE_PREVIEWS.normal;
      setEdgeDialogue(preview);
      try {
        const locationKey = `${window.location.pathname}${window.location.search}`;
        const context = mascotPageContext(locationKey);
        sessionStorage.setItem(`booknerd-mascot-shown:v2:${mode}:${context}:${locationKey}`, '1');
        localStorage.setItem(LAST_AUTO_KEY, String(Date.now()));
      } catch { /* preview remains visible without storage */ }
    };
    const onSettings = (event) => {
      const next = normalizeMascotSettings(event.detail || loadMascotSettings());
      const modeChanged = next.mode !== settingsRef.current.mode;
      settingsRef.current = next;
      setSettings(next);
      if (modeChanged) showModePreview(next.mode);
    };
    const onModePreview = (event) => showModePreview(normalizeMascotSettings({ ...settingsRef.current, mode: event.detail?.mode }).mode);
    const onOpen = (event) => {
      if (event.detail) setManualContext(event.detail);
      setEdgeDialogue(null);
      setOpen(true);
    };
    const onClear = () => setHistory([]);
    let routeTimer = null;
    const updatePath = () => setPathname(`${window.location.pathname}${window.location.search}`);
    const onLinkClick = (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      window.clearTimeout(routeTimer);
      routeTimer = window.setTimeout(updatePath, 0);
    };
    window.addEventListener('booknerd:mascot-settings', onSettings);
    window.addEventListener('booknerd:preview-mascot-mode', onModePreview);
    window.addEventListener('booknerd:open-mascots', onOpen);
    window.addEventListener('booknerd:mascot-history-cleared', onClear);
    window.addEventListener('popstate', updatePath);
    window.addEventListener('hashchange', updatePath);
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.clearTimeout(routeTimer);
      window.removeEventListener('booknerd:mascot-settings', onSettings);
      window.removeEventListener('booknerd:preview-mascot-mode', onModePreview);
      window.removeEventListener('booknerd:open-mascots', onOpen);
      window.removeEventListener('booknerd:mascot-history-cleared', onClear);
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('hashchange', updatePath);
      document.removeEventListener('click', onLinkClick, true);
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!previousPathRef.current) {
      previousPathRef.current = pathname;
      return;
    }
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname;
      setManualContext(null);
      setEdgeDialogue(null);
      setPendingSpoilerQuestion('');
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!ready || hiddenByPage) return;
    let active = true;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CONFIG_SESSION_KEY) || 'null');
      if (cached?.savedAt && Date.now() - cached.savedAt < 30 * 60 * 1000) {
        setSystemConfig(normalizeSystemConfig(cached.config));
        return;
      }
    } catch { /* fetch a fresh lightweight configuration */ }
    fetch('/api/mascots?view=config', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data?.config) return;
        const nextConfig = normalizeSystemConfig(data.config);
        setSystemConfig(nextConfig);
        try { sessionStorage.setItem(CONFIG_SESSION_KEY, JSON.stringify({ savedAt: Date.now(), config: nextConfig })); } catch { /* optional cache */ }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [hiddenByPage, ready]);

  useEffect(() => {
    if (!ready || globallyHidden || hiddenByPage || readerHidden) return undefined;
    if (!AUTO_PAGE_CONTEXTS.has(pageContext)) return undefined;
    const pageKey = `booknerd-mascot-shown:v2:${settings.mode}:${pageContext}:${pathname}`;
    try {
      if (sessionStorage.getItem(pageKey) === '1') return undefined;
      const last = Number(localStorage.getItem(LAST_AUTO_KEY) || 0);
      const interval = settings.mode === 'more' ? 2 * 60 * 1000 : settings.mode === 'tips' ? 10 * 60 * 1000 : 20 * 60 * 1000;
      if (Date.now() - last < interval) return undefined;
    } catch { /* show at most once in memory */ }

    const isAllowed = (dialogue) => {
      if (!(dialogue.pages || []).includes(pageContext)) return false;
      if (!settings.showGreeting && ['greeting', 'returning'].includes(dialogue.category)) return false;
      if (!settings.showRecommendations && dialogue.category === 'recommendation') return false;
      if (settings.mode === 'tips' && !TIP_CATEGORIES.has(dialogue.category)) return false;
      return true;
    };
    const customCandidates = (systemConfig.dialogues || []).filter(isAllowed);
    const builtinCandidates = BUILTIN_DIALOGUES.filter(isAllowed);
    const candidates = customCandidates.length ? customCandidates : builtinCandidates;
    const chosen = selectDialogueByFirstSpeaker(candidates, effectiveFirstSpeaker);
    if (!chosen) return undefined;
    const timer = window.setTimeout(() => {
      const maxLines = settings.mode === 'tips' ? 2 : settings.mode === 'more' ? 5 : 3;
      setEdgeDialogue({ ...chosen, lines: chosen.lines.slice(0, maxLines) });
      try {
        sessionStorage.setItem(pageKey, '1');
        localStorage.setItem(LAST_AUTO_KEY, String(Date.now()));
      } catch { /* frequency protection remains best effort */ }
    }, settings.mode === 'more' ? 650 : settings.mode === 'tips' ? 1200 : 2400);
    return () => window.clearTimeout(timer);
  }, [effectiveFirstSpeaker, globallyHidden, hiddenByPage, pageContext, pathname, readerHidden, ready, settings.mode, settings.showGreeting, settings.showRecommendations, systemConfig.dialogues]);

  useEffect(() => {
    setEdgeLineIndex(0);
    const lineCount = edgeDialogue?.lines?.length || 0;
    if (lineCount < 2) return undefined;
    const timer = window.setInterval(() => {
      setEdgeLineIndex((index) => {
        if (index >= lineCount - 1) {
          window.clearInterval(timer);
          return index;
        }
        return index + 1;
      });
    }, settings.reducedMotion ? 3600 : 2600);
    return () => window.clearInterval(timer);
  }, [edgeDialogue, settings.reducedMotion]);

  useEffect(() => {
    if (!edgeDialogue) return undefined;
    const timer = window.setTimeout(() => setEdgeDialogue(null), settings.mode === 'more' ? 14000 : 9500);
    return () => window.clearTimeout(timer);
  }, [edgeDialogue, settings.mode]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll('button, input, select, a[href]')].filter((node) => !node.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
      else launcherRef.current?.focus();
    };
  }, [open]);

  useEffect(() => saveHistory(history), [history]);

  const displayedHistory = useMemo(
    () => history.length ? history : normalizeMessages(openingDialogue(effectiveFirstSpeaker)),
    [effectiveFirstSpeaker, history],
  );

  const closePanel = () => setOpen(false);
  const clearHistory = () => {
    setHistory([]);
    setPendingSpoilerQuestion('');
    try { localStorage.removeItem(MASCOT_HISTORY_KEY); } catch { /* optional local history */ }
  };

  const ask = async (questionValue, options = {}) => {
    const question = String(questionValue || input).trim().slice(0, 1000);
    if (!question || sending) return;
    if (options.recordReader !== false) {
      const readerMessage = normalizeMessages([{ character: 'reader', text: question }]);
      setHistory((current) => [...current, ...readerMessage].slice(-MAX_HISTORY));
    }
    setInput('');
    setPendingSpoilerQuestion('');
    setSending(true);
    if (!navigator.onLine) {
      setHistory((current) => [...current, ...normalizeMessages(OFFLINE_DIALOGUE)].slice(-MAX_HISTORY));
      setSending(false);
      return;
    }
    try {
      const response = await fetch('/api/mascots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, askMode, bookSlug, currentChapter, visitorKey: getVisitorKey(), allowSpoilers: options.allowSpoilers === true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Ответ временно недоступен.');
      setHistory((current) => [...current, ...normalizeMessages(data.messages || [])].slice(-MAX_HISTORY));
      if (data.requiresSpoilerConfirmation) setPendingSpoilerQuestion(question);
    } catch {
      setHistory((current) => [...current, ...normalizeMessages([
        { character: 'till', text: 'Кажется, ответ потерялся по дороге.' },
        { character: 'ivan', text: 'Попробуйте ещё раз чуть позже. BOOKNERD продолжает работать.' },
      ])].slice(-MAX_HISTORY));
    } finally {
      setSending(false);
    }
  };

  if (!ready || hiddenByPage || globallyHidden) return null;

  const edgeLine = edgeDialogue?.lines?.[edgeLineIndex] || edgeDialogue?.lines?.[0] || null;
  const edgeSpeaker = edgeLine?.character === 'till' ? 'till' : 'ivan';

  return (
    <div className={`mascot-system${settings.reducedMotion ? ' is-reduced-motion' : ''}`} data-page={pageContext}>
      {edgeDialogue && !open ? (
        <aside className="mascot-edge-banter" aria-live="polite">
          <button type="button" className="mascot-edge-close" onClick={() => setEdgeDialogue(null)} aria-label="Скрыть реплики Ивана и Тилла"><X size={16} /></button>
          <div className={`mascot-edge-side is-ivan${edgeSpeaker === 'ivan' ? ' is-active' : ''}`}><CharacterPortrait character="ivan" /><div>{edgeSpeaker === 'ivan' && edgeLine ? <p key={edgeLineIndex}>{edgeLine.text}</p> : <span aria-hidden="true">•••</span>}</div></div>
          <div className={`mascot-edge-side is-till${edgeSpeaker === 'till' ? ' is-active' : ''}`}><div>{edgeSpeaker === 'till' && edgeLine ? <p key={edgeLineIndex}>{edgeLine.text}</p> : <span aria-hidden="true">•••</span>}</div><CharacterPortrait character="till" /></div>
          <button type="button" className="mascot-edge-open" onClick={() => { setEdgeDialogue(null); setOpen(true); }}>Открыть помощников</button>
        </aside>
      ) : null}

      {!readerHidden ? (
        <button ref={launcherRef} type="button" className="mascot-launcher" onClick={() => { setEdgeDialogue(null); setOpen(true); }} aria-label="Открыть помощников Ивана и Тилла">
          <CharacterPortrait character="ivan" compact /><CharacterPortrait character="till" compact /><span className="mascot-online-dot" aria-hidden="true" />
        </button>
      ) : null}

      {open ? (
        <div className="mascot-panel-backdrop" onPointerDown={(event) => event.target === event.currentTarget && closePanel()}>
          <aside
            ref={panelRef}
            className="mascot-chat-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Иван и Тилл — книжные помощники"
            onPointerDown={(event) => { if (event.pointerType === 'touch') swipeStart.current = event.clientY; }}
            onPointerUp={(event) => { if (swipeStart.current != null && event.clientY - swipeStart.current > 85) closePanel(); swipeStart.current = null; }}
          >
            <div className="mascot-mobile-handle" aria-hidden="true" />
            <header className="mascot-chat-header">
              <div className="mascot-chat-portraits" aria-hidden="true"><CharacterPortrait character="ivan" compact /><CharacterPortrait character="till" compact /></div>
              <div><small><i /> ДОСТУПНЫ</small><h2>Иван и Тилл</h2></div>
              <a href="/profile#ivan-and-till-settings" aria-label="Настройки Ивана и Тилла"><Settings size={18} /></a>
              <button type="button" onClick={closePanel} aria-label="Свернуть помощников"><Minus size={19} /></button>
              <button type="button" onClick={closePanel} aria-label="Закрыть помощников"><X size={20} /></button>
            </header>

            <label className="mascot-ask-mode">
              <span>Кого спросить</span>
              <select value={askMode} onChange={(event) => setAskMode(event.target.value)}>
                <option value="both">Спросить обоих</option>
                <option value="ivan">Спросить Ивана</option>
                <option value="till">Спросить Тилла</option>
              </select>
              <ChevronDown size={16} />
            </label>

            <DialogueMessages messages={displayedHistory} />

            {pendingSpoilerQuestion ? (
              <div className="mascot-spoiler-actions" role="group" aria-label="Разрешить ответ со спойлерами">
                <button type="button" onClick={() => {
                  setPendingSpoilerQuestion('');
                  setHistory((current) => [...current, ...normalizeMessages([{ character: 'ivan', text: 'Хорошо. Оставляем только то, что уже прочитано.' }])].slice(-MAX_HISTORY));
                }}>Нет, без спойлеров</button>
                <button type="button" onClick={() => ask(pendingSpoilerQuestion, { allowSpoilers: true, recordReader: false })}>Показать</button>
              </div>
            ) : null}

            <div className="mascot-quick-questions" aria-label="Быстрые вопросы">
              {MASCOT_QUICK_QUESTIONS.map((question) => <button type="button" onClick={() => ask(question)} disabled={sending} key={question}>{question}</button>)}
            </div>

            <form className="mascot-chat-form" onSubmit={(event) => { event.preventDefault(); ask(); }}>
              <label><span className="sr-only">Спросить о книге</span><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Спросить о книге…" maxLength={1000} /></label>
              <button type="submit" disabled={!input.trim() || sending} aria-label="Отправить вопрос">{sending ? <span className="mascot-sending" /> : <Send size={19} />}</button>
            </form>
            <footer className="mascot-chat-footer"><span>{settings.mode === 'more' ? 'Режим: больше сценок' : settings.mode === 'tips' ? 'Режим: только подсказки' : 'Режим: обычный'} · первым отвечает {effectiveFirstSpeaker === 'ivan' ? 'Иван' : 'Тилл'}</span><button type="button" onClick={clearHistory}><Eraser size={15} /> Очистить</button></footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
