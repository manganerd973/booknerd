'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { CHAPTER_ENDING_DIALOGUES, loadMascotSettings, normalizeMascotSettings } from './mascot-config.js';
import MascotSprite, { preloadMascotSprites } from './mascot-sprite.jsx';
import { normalizeMascotLines } from './mascot-emotions.js';

export default function MascotChapterEnding({ bookSlug = '', currentChapter = 0 }) {
  const [visible, setVisible] = React.useState(false);
  const [dialogue, setDialogue] = React.useState(() => normalizeMascotLines(CHAPTER_ENDING_DIALOGUES.till, { category: 'chapter-ending' }));
  const [lineIndex, setLineIndex] = React.useState(0);
  const [settled, setSettled] = React.useState(false);
  const line = dialogue[lineIndex] || dialogue[0];
  const ivanExpression = settled ? 'neutral' : line?.character === 'ivan' ? line.expression : line?.listenerReaction || 'neutral';
  const tillExpression = settled ? 'neutral' : line?.character === 'till' ? line.expression : line?.listenerReaction || 'neutral';

  React.useEffect(() => {
    let active = true;
    const applySettings = (value) => {
      const settings = normalizeMascotSettings(value || loadMascotSettings());
      setVisible(settings.mode !== 'hidden' && settings.mode !== 'tips' && settings.showChapterEnding !== false);
    };
    applySettings();
    const onSettings = (event) => applySettings(event.detail);
    window.addEventListener('booknerd:mascot-settings', onSettings);
    if (navigator.onLine) {
      fetch('/api/mascots?view=config', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (!active || data?.config?.enabled === false) { if (active && data?.config?.enabled === false) setVisible(false); return; }
          const custom = data?.config?.dialogues?.find((item) => item.category === 'chapter-ending' && Array.isArray(item.lines) && item.lines.length);
          const next = normalizeMascotLines(custom?.lines || CHAPTER_ENDING_DIALOGUES.till, { category: 'chapter-ending' });
          preloadMascotSprites(next);
          setDialogue(next);
        }).catch(() => {});
    }
    return () => { active = false; window.removeEventListener('booknerd:mascot-settings', onSettings); };
  }, []);

  React.useEffect(() => {
    if (!visible || !line) return undefined;
    const timer = window.setTimeout(() => {
      if (lineIndex >= dialogue.length - 1) setSettled(true);
      else setLineIndex((value) => value + 1);
    }, line.delayMs + line.durationMs);
    return () => window.clearTimeout(timer);
  }, [dialogue.length, line, lineIndex, visible]);

  if (!visible) return null;
  return (
    <section className="mascot-chapter-ending" aria-label="Иван и Тилл после главы">
      <div className="mascot-chapter-characters" aria-hidden="true">
        <MascotSprite character="till" expression={tillExpression} pose={line?.character === 'till' ? line.pose : 'natural'} gaze={line?.character === 'till' ? line.gaze : 'at-other'} />
        <MascotSprite character="ivan" expression={ivanExpression} pose={line?.character === 'ivan' ? line.pose : 'natural'} gaze={line?.character === 'ivan' ? line.gaze : 'at-other'} />
      </div>
      <div className="mascot-chapter-lines" aria-live="polite"><p className={`is-${line?.character || 'ivan'}`} key={`${line?.id || lineIndex}`}><strong>{line?.character === 'till' ? 'Тилл' : 'Иван'}:</strong> {line?.text}</p></div>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('booknerd:open-mascots', { detail: { bookSlug, currentChapter } }))}><MessageCircle size={16} /> Спросить о книге</button>
      <button type="button" className="mascot-chapter-hide" onClick={() => setVisible(false)}>Скрыть</button>
    </section>
  );
}
