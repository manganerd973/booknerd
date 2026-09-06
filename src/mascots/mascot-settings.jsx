'use client';

import React from 'react';
import { Check, EyeOff, MessageCircleHeart, Play, Sparkles } from 'lucide-react';
import { DEFAULT_MASCOT_SETTINGS, MASCOT_MODES, saveMascotSettings } from './mascot-config.js';

export default function MascotSettings({ value = DEFAULT_MASCOT_SETTINGS, onChange }) {
  const settings = { ...DEFAULT_MASCOT_SETTINGS, ...(value || {}) };
  const update = (patch) => {
    const next = { ...settings, ...patch };
    saveMascotSettings(next);
    onChange?.(next);
  };

  return (
    <section className="mascot-profile-settings" id="ivan-and-till-settings">
      <div className="mascot-settings-title">
        <span className="mascot-settings-portrait"><img src="/mascots/ivan.webp" alt="" /><img src="/mascots/till.webp" alt="" /></span>
        <div><small>ПОМОЩНИКИ BOOKNERD</small><h2>Иван и Тилл</h2><p>Выберите, как часто они могут появляться и помогать Вам.</p></div>
      </div>

      <div className="mascot-mode-grid" role="radiogroup" aria-label="Режим помощников">
        {MASCOT_MODES.map((mode) => (
          <button
            type="button"
            role="radio"
            aria-checked={settings.mode === mode.id}
            className={settings.mode === mode.id ? 'is-active' : ''}
            onClick={() => update({ mode: mode.id })}
            key={mode.id}
          >
            {mode.id === 'hidden' ? <EyeOff size={20} /> : mode.id === 'tips' ? <MessageCircleHeart size={20} /> : <Sparkles size={20} />}
            <span><strong>{mode.label}</strong><small>{mode.description}</small></span>
            {settings.mode === mode.id ? <Check size={17} /> : null}
          </button>
        ))}
      </div>

      <div className={`mascot-mode-status is-${settings.mode}`} role="status">
        <span><Check size={17} /> Сейчас включён: <strong>{MASCOT_MODES.find((mode) => mode.id === settings.mode)?.label}</strong></span>
        {settings.mode !== 'hidden' ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('booknerd:preview-mascot-mode', { detail: { mode: settings.mode } }))}><Play size={16} /> Проверить режим</button> : <small>Кнопка помощников и автоматические реплики скрыты. Вы сможете включить их здесь снова.</small>}
      </div>

      <div className="mascot-toggle-list">
        {[
          ['quietReading', 'Тишина во время чтения', 'Автоматически скрывать помощников внутри главы.'],
          ['reducedMotion', 'Уменьшить анимации', 'Оставить спокойные статичные появления.'],
          ['showGreeting', 'Показывать приветствие', 'Не чаще одного приветствия за разумный промежуток времени.'],
          ['showChapterEnding', 'Реакции после главы', 'Показывать компактную сценку только после последнего абзаца.'],
          ['showRecommendations', 'Книжные рекомендации', 'Разрешить полезные подсказки на страницах книг.'],
        ].map(([key, title, description]) => (
          <button type="button" className={settings[key] ? 'is-active' : ''} onClick={() => update({ [key]: !settings[key] })} aria-pressed={settings[key]} key={key}>
            <span><strong>{title}</strong><small>{description}</small></span><i aria-hidden="true" />
          </button>
        ))}
      </div>

      <button
        type="button"
        className="mascot-clear-history"
        onClick={() => {
          try { localStorage.removeItem('booknerd-mascot-history-v1'); } catch { /* optional local history */ }
          window.dispatchEvent(new Event('booknerd:mascot-history-cleared'));
        }}
      >Очистить историю разговора</button>
    </section>
  );
}
