'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { CHAPTER_ENDING_DIALOGUE, loadMascotSettings } from './mascot-config.js';

export default function MascotChapterEnding() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const settings = loadMascotSettings();
    setVisible(settings.mode !== 'hidden' && settings.showChapterEnding !== false);
  }, []);

  if (!visible) return null;

  return (
    <section className="mascot-chapter-ending" aria-label="Иван и Тилл после главы">
      <div className="mascot-chapter-characters" aria-hidden="true">
        <img src="/mascots/till.webp" alt="" />
        <img src="/mascots/ivan.webp" alt="" />
      </div>
      <div className="mascot-chapter-lines">
        {CHAPTER_ENDING_DIALOGUE.map((line, index) => <p className={`is-${line.character}`} key={`${line.character}-${index}`}><strong>{line.character === 'ivan' ? 'Иван' : 'Тилл'}:</strong> {line.text}</p>)}
      </div>
      <button type="button" onClick={() => window.dispatchEvent(new Event('booknerd:open-mascots'))}><MessageCircle size={16} /> Спросить о книге</button>
      <button type="button" className="mascot-chapter-hide" onClick={() => setVisible(false)}>Скрыть</button>
    </section>
  );
}
