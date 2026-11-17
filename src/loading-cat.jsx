'use client';
import PurpleCat from './purple-cat.jsx';
import React, { useEffect, useRef, useState } from 'react';
export default function LoadingCat() {
  const audio = useRef(null);
  const [purring, setPurring] = useState(false);
  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);
  async function togglePurr() {
    if (audio.current) { await audio.current.close(); audio.current = null; setPurring(false); return; }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext(); audio.current = context;
    try {
      await context.resume();
      const oscillator = context.createOscillator(), gain = context.createGain();
      const pulse = context.createOscillator(), modulation = context.createGain();
      oscillator.frequency.value = 65; gain.gain.value = .035;
      pulse.frequency.value = 24; modulation.gain.value = .02;
      pulse.connect(modulation).connect(gain.gain); oscillator.connect(gain).connect(context.destination);
      oscillator.start(); pulse.start(); setPurring(true);
    } catch { await context.close().catch(() => {}); audio.current = null; }
  }
  return <main className="book-loading-screen cat-loading-screen">
    <div role="status" aria-live="polite"><PurpleCat /><strong>мууууур</strong><span className="loading-cat-caption">Загружаем историю…</span></div>
    <button type="button" className="loading-purr-button" onClick={togglePurr}>{purring ? 'Выключить мурчание' : 'Включить мурчание'}</button>
  </main>;
}
