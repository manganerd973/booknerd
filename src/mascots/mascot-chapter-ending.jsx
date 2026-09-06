'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { CHAPTER_ENDING_DIALOGUES, loadMascotSettings, normalizeMascotSettings } from './mascot-config.js';
import { resolveFirstSpeaker } from './mascot-dialogue-engine.js';

export default function MascotChapterEnding({ bookSlug = '', currentChapter = 0 }) {
  const [visible, setVisible] = React.useState(false);
  const [dialogue, setDialogue] = React.useState(CHAPTER_ENDING_DIALOGUES.till);
  const customDialogueRef = React.useRef(null);

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
          if (!active || data?.config?.enabled === false) {
            if (active && data?.config?.enabled === false) setVisible(false);
            return;
          }
          const custom = data?.config?.dialogues?.find((item) => item.category === 'chapter-ending' && Array.isArray(item.lines) && item.lines.length);
          if (custom) {
            customDialogueRef.current = custom.lines;
            setDialogue(custom.lines);
          } else {
            const firstSpeaker = resolveFirstSpeaker(data?.config?.defaultFirstSpeaker || 'alternate');
            setDialogue(CHAPTER_ENDING_DIALOGUES[firstSpeaker] || CHAPTER_ENDING_DIALOGUES.till);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      window.removeEventListener('booknerd:mascot-settings', onSettings);
    };
  }, []);

  if (!visible) return null;

  return (
    <section className="mascot-chapter-ending" aria-label="Иван и Тилл после главы">
      <div className="mascot-chapter-characters" aria-hidden="true">
        <img src="/mascots/till.webp" alt="" />
        <img src="/mascots/ivan.webp" alt="" />
      </div>
      <div className="mascot-chapter-lines">
        {dialogue.map((line, index) => <p className={`is-${line.character}`} key={`${line.character}-${index}`}><strong>{line.character === 'ivan' ? 'Иван' : line.character === 'till' ? 'Тилл' : 'Иван и Тилл'}:</strong> {line.text}</p>)}
      </div>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('booknerd:open-mascots', { detail: { bookSlug, currentChapter } }))}><MessageCircle size={16} /> Спросить о книге</button>
      <button type="button" className="mascot-chapter-hide" onClick={() => setVisible(false)}>Скрыть</button>
    </section>
  );
}
