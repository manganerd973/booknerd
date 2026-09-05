'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eraser, MessageCircle, Minus, Send, Settings, X } from 'lucide-react';
import {
  BUILTIN_DIALOGUES,
  DEFAULT_MASCOT_SETTINGS,
  MASCOT_HISTORY_KEY,
  MASCOT_QUICK_QUESTIONS,
  OFFLINE_DIALOGUE,
  loadMascotSettings,
  mascotBookSlug,
  mascotPageContext,
} from './mascot-config.js';
import { getVisitorKey } from '../site-analytics.js';

const CONFIG_SESSION_KEY = 'booknerd-mascot-config-v1';
const LAST_AUTO_KEY = 'booknerd-mascot-last-auto-v1';
const MAX_HISTORY = 24;

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
  const [systemConfig, setSystemConfig] = useState({ enabled: true, aiEnabled: false, disabledPages: [], dialogues: [] });
  const [open, setOpen] = useState(false);
  const [edgeDialogue, setEdgeDialogue] = useState(null);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [askMode, setAskMode] = useState('both');
  const [sending, setSending] = useState(false);
  const [manualContext, setManualContext] = useState(null);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const swipeStart = useRef(null);

  const pageContext = mascotPageContext(pathname);
  const hiddenByPage = pageContext === 'hidden' || systemConfig.disabledPages.includes(pageContext);
  const globallyHidden = !systemConfig.enabled || settings.mode === 'hidden';
  const readerHidden = pageContext === 'reader' && settings.quietReading;
  const bookSlug = manualContext?.bookSlug || mascotBookSlug(pathname);
  const currentChapter = Number(manualContext?.currentChapter || 0);

  useEffect(() => {
    setPathname(window.location.pathname);
    setSettings(loadMascotSettings());
    setHistory(readHistory());
    setReady(true);

    const onSettings = (event) => setSettings({ ...DEFAULT_MASCOT_SETTINGS, ...(event.detail || loadMascotSettings()) });
    const onOpen = (event) => {
      if (event.detail) setManualContext(event.detail);
      setEdgeDialogue(null);
      setOpen(true);
    };
    const onClear = () => setHistory([]);
    window.addEventListener('booknerd:mascot-settings', onSettings);
    window.addEventListener('booknerd:open-mascots', onOpen);
    window.addEventListener('booknerd:mascot-history-cleared', onClear);
    return () => {
      window.removeEventListener('booknerd:mascot-settings', onSettings);
      window.removeEventListener('booknerd:open-mascots', onOpen);
      window.removeEventListener('booknerd:mascot-history-cleared', onClear);
    };
  }, []);

  useEffect(() => {
    if (!ready || hiddenByPage) return;
    let active = true;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CONFIG_SESSION_KEY) || 'null');
      if (cached?.savedAt && Date.now() - cached.savedAt < 5 * 60 * 1000) {
        setSystemConfig(cached.config);
        return;
      }
    } catch { /* fetch a fresh lightweight configuration */ }
    fetch('/api/mascots?view=config', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data?.config) return;
        setSystemConfig(data.config);
        try { sessionStorage.setItem(CONFIG_SESSION_KEY, JSON.stringify({ savedAt: Date.now(), config: data.config })); } catch { /* optional cache */ }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [hiddenByPage, ready]);

  useEffect(() => {
    if (!ready || globallyHidden || hiddenByPage || readerHidden || !settings.showGreeting) return undefined;
    if (!['home', 'book', 'notifications'].includes(pageContext)) return undefined;
    const pageKey = `booknerd-mascot-shown:${pageContext}:${pathname}`;
    try {
      if (sessionStorage.getItem(pageKey) === '1') return undefined;
      const last = Number(localStorage.getItem(LAST_AUTO_KEY) || 0);
      const interval = settings.mode === 'more' ? 5 * 60 * 1000 : 20 * 60 * 1000;
      if (Date.now() - last < interval) return undefined;
    } catch { /* show at most once in memory */ }

    const candidates = [...(systemConfig.dialogues || []), ...BUILTIN_DIALOGUES]
      .filter((dialogue) => (dialogue.pages || []).includes(pageContext));
    const chosen = candidates[Math.floor(Date.now() / 60000) % Math.max(1, candidates.length)];
    if (!chosen) return undefined;
    const timer = window.setTimeout(() => {
      setEdgeDialogue({ ...chosen, lines: settings.mode === 'tips' ? chosen.lines.slice(0, 1) : chosen.lines.slice(0, 4) });
      try {
        sessionStorage.setItem(pageKey, '1');
        localStorage.setItem(LAST_AUTO_KEY, String(Date.now()));
      } catch { /* frequency protection remains best effort */ }
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [globallyHidden, hiddenByPage, pageContext, pathname, readerHidden, ready, settings.mode, settings.showGreeting, systemConfig.dialogues]);

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

  const displayedHistory = useMemo(() => history.length ? history : normalizeMessages([
    { character: 'till', text: 'Вы открыли нас. Значит, вопрос действительно важный.' },
    { character: 'ivan', text: 'Или Вам просто понравилась кнопка. Оба варианта разумны.' },
  ]), [history]);

  const closePanel = () => setOpen(false);
  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem(MASCOT_HISTORY_KEY); } catch { /* optional local history */ }
  };

  const ask = async (questionValue) => {
    const question = String(questionValue || input).trim().slice(0, 1000);
    if (!question || sending) return;
    const readerMessage = normalizeMessages([{ character: 'reader', text: question }]);
    setHistory((current) => [...current, ...readerMessage].slice(-MAX_HISTORY));
    setInput('');
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
        body: JSON.stringify({ question, askMode, bookSlug, currentChapter, visitorKey: getVisitorKey() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Ответ временно недоступен.');
      setHistory((current) => [...current, ...normalizeMessages(data.messages || [])].slice(-MAX_HISTORY));
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

  return (
    <div className={`mascot-system${settings.reducedMotion ? ' is-reduced-motion' : ''}`} data-page={pageContext}>
      {edgeDialogue && !open ? (
        <aside className="mascot-edge-banter" aria-live="polite">
          <button type="button" className="mascot-edge-close" onClick={() => setEdgeDialogue(null)} aria-label="Скрыть реплики Ивана и Тилла"><X size={16} /></button>
          <div className="mascot-edge-side is-ivan"><CharacterPortrait character="ivan" /><div>{edgeDialogue.lines.filter((line) => line.character === 'ivan').map((line, index) => <p key={index}>{line.text}</p>)}</div></div>
          <div className="mascot-edge-side is-till"><div>{edgeDialogue.lines.filter((line) => line.character === 'till').map((line, index) => <p key={index}>{line.text}</p>)}</div><CharacterPortrait character="till" /></div>
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

            <div className="mascot-quick-questions" aria-label="Быстрые вопросы">
              {MASCOT_QUICK_QUESTIONS.map((question) => <button type="button" onClick={() => ask(question)} disabled={sending} key={question}>{question}</button>)}
            </div>

            <form className="mascot-chat-form" onSubmit={(event) => { event.preventDefault(); ask(); }}>
              <label><span className="sr-only">Спросить о книге</span><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Спросить о книге…" maxLength={1000} /></label>
              <button type="submit" disabled={!input.trim() || sending} aria-label="Отправить вопрос">{sending ? <span className="mascot-sending" /> : <Send size={19} />}</button>
            </form>
            <footer className="mascot-chat-footer"><span>{systemConfig.aiEnabled ? 'AI включён редакцией' : 'Без автоматических AI-запросов'}</span><button type="button" onClick={clearHistory}><Eraser size={15} /> Очистить</button></footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
