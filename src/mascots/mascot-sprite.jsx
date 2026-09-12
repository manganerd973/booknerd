'use client';

import React from 'react';
import { emotionVisual, isApprovedEmotion } from './mascot-emotions.js';

function EyePair({ type, character }) {
  const y = character === 'ivan' ? 51 : 54;
  const color = '#172126';
  if (['closed', 'sleepy', 'happy'].includes(type)) {
    const bend = type === 'happy' ? -2 : type === 'sleepy' ? 1 : 0;
    return <g className={`mascot-eyes is-${type}`} stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round"><path d={`M35 ${y} Q41 ${y + bend} 46 ${y}`} /><path d={`M54 ${y} Q60 ${y + bend} 66 ${y}`} /></g>;
  }
  if (type === 'sad') return <g stroke={color} strokeWidth="2.1" fill="none" strokeLinecap="round"><path d={`M35 ${y - 1} Q41 ${y - 4} 46 ${y}`} /><path d={`M54 ${y} Q60 ${y - 4} 66 ${y - 1}`} /></g>;
  if (type === 'angry' || type === 'focused') return <g stroke={color} strokeWidth="2.2" fill={character === 'till' ? '#fffaf0' : 'none'} strokeLinecap="round"><path d={`M35 ${y - 3} L46 ${y + 1}`} /><path d={`M54 ${y + 1} L66 ${y - 3}`} />{character === 'till' ? <><ellipse cx="41" cy={y + 2} rx="5" ry="6" /><ellipse cx="60" cy={y + 2} rx="5" ry="6" /></> : null}</g>;
  if (type === 'skeptic' || type === 'uneven') return <g stroke={color} strokeWidth="2.1" fill={character === 'till' ? '#fffaf0' : 'none'} strokeLinecap="round"><path d={`M35 ${y + 1} Q41 ${y - 1} 46 ${y + 1}`} /><path d={`M55 ${y - 3} L66 ${y}`} /></g>;
  if (type === 'side' || type === 'aside' || type === 'down') {
    const dx = type === 'side' ? 2 : type === 'aside' ? -2 : 0;
    const dy = type === 'down' ? 3 : 0;
    return <g fill={character === 'till' ? '#fffaf0' : '#172126'} stroke={color} strokeWidth="1.5"><ellipse cx={41 + dx} cy={y + dy} rx="5" ry="6" /><ellipse cx={60 + dx} cy={y + dy} rx="5" ry="6" />{character === 'till' ? <><circle cx={42 + dx} cy={y + dy} r="1.4" fill={color} /><circle cx={61 + dx} cy={y + dy} r="1.4" fill={color} /></> : null}</g>;
  }
  const wide = type === 'wide';
  return <g fill={character === 'till' ? '#fffaf0' : '#172126'} stroke={color} strokeWidth="1.5"><ellipse cx="41" cy={y} rx={wide ? 6 : 4.5} ry={wide ? 7 : 5.5} /><ellipse cx="60" cy={y} rx={wide ? 6 : 4.5} ry={wide ? 7 : 5.5} />{character === 'till' ? <><circle cx="41" cy={y + 1} r="1.4" fill={color} /><circle cx="60" cy={y + 1} r="1.4" fill={color} /></> : null}</g>;
}

function Mouth({ type, character }) {
  const y = character === 'ivan' ? 59 : 64;
  const color = '#172126';
  if (type === 'open') return <ellipse cx="50.5" cy={y} rx="4.6" ry="5.5" fill="#f28a91" stroke={color} strokeWidth="1.7" />;
  if (type === 'o') return <ellipse cx="50.5" cy={y} rx="2.8" ry="3.4" fill="#f7b0ae" stroke={color} strokeWidth="1.7" />;
  if (type === 'frown' || type === 'pout') return <path d={`M45 ${y + 2} Q50.5 ${type === 'pout' ? y - 1 : y - 3} 56 ${y + 2}`} stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round" />;
  if (type === 'flat') return <path d={`M46 ${y} L55 ${y}`} stroke={color} strokeWidth="1.9" strokeLinecap="round" />;
  if (type === 'smirk') return <path d={`M45 ${y} Q51 ${y + 4} 57 ${y - 1}`} stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round" />;
  if (type === 'grin') return <path d={`M44 ${y - 1} Q50.5 ${y + 7} 57 ${y - 1}`} fill="#fffaf0" stroke={color} strokeWidth="1.7" />;
  return <path d={`M46 ${y - 1} Q50.5 ${y + (type === 'smile' ? 4 : 2)} 55 ${y - 1}`} stroke={color} strokeWidth="1.7" fill="none" strokeLinecap="round" />;
}

function EmotionOverlay({ character, expression }) {
  const visual = emotionVisual(character, expression);
  const patch = character === 'ivan' ? '#465477' : '#a9e8dc';
  const patchY = character === 'ivan' ? 44 : 43;
  const patchHeight = character === 'ivan' ? 19 : 28;
  return (
    <svg className="mascot-expression-overlay" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy={patchY + patchHeight / 2} rx={character === 'ivan' ? 22 : 21} ry={patchHeight / 2} fill={patch} opacity=".96" />
      <EyePair type={visual.eyes} character={character} />
      <Mouth type={visual.mouth} character={character} />
      <g className={`mascot-blush is-${visual.blush}`} fill="#f27f8f">
        <ellipse cx="34" cy={character === 'ivan' ? 59 : 64} rx="5" ry="2.2" />
        <ellipse cx="67" cy={character === 'ivan' ? 59 : 64} rx="5" ry="2.2" />
      </g>
      {visual.mark === 'tear' || visual.mark === 'cry' ? <g className={`mascot-tears is-${visual.mark}`} fill="none" stroke="#67bde4" strokeWidth="2" strokeLinecap="round"><path d="M37 60 Q34 67 36 72" /><path d="M63 60 Q67 67 64 72" />{visual.mark === 'cry' ? <><path d="M32 61 Q26 67 29 75" /><path d="M68 61 Q75 67 72 75" /></> : null}</g> : null}
      {visual.mark === 'heart' ? <path className="mascot-mark" d="M76 38 C72 33 66 38 76 47 C86 38 80 33 76 38Z" fill="#ef7d8d" /> : null}
      {visual.mark === 'spark' ? <path className="mascot-mark" d="M77 34 L79 40 L85 42 L79 44 L77 50 L75 44 L69 42 L75 40Z" fill="#d3a842" /> : null}
      {visual.mark === 'anger' ? <path className="mascot-mark" d="M72 35 l5 3 4-4-2 6 5 3-6-1-3 5 1-6-5-2z" fill="#d55a52" /> : null}
      {visual.mark === 'question' ? <text className="mascot-mark" x="76" y="43" fill="#b78a31" fontSize="14" fontWeight="900">?</text> : null}
      {visual.mark === 'zzz' ? <text className="mascot-mark" x="70" y="39" fill="#668ca9" fontSize="9" fontWeight="900">Zz</text> : null}
      {visual.mark === 'sweat' ? <path className="mascot-mark" d="M75 37 Q81 44 75 48 Q69 44 75 37Z" fill="#67bde4" /> : null}
      {visual.mark === 'paw' ? <ellipse className="mascot-paw-overlay" cx="55" cy="62" rx="8" ry="6" fill={patch} stroke="#172126" strokeWidth="1.6" /> : null}
      {visual.mark === 'book' ? <g className="mascot-prop"><path d="M34 73 Q42 69 50 74 Q58 69 67 73 L66 86 Q58 82 50 87 Q42 82 35 86Z" fill="#315949" stroke="#c5a45a" strokeWidth="1.2" /><path d="M50 74 V87" stroke="#c5a45a" /></g> : null}
      {visual.mark === 'award' ? <g className="mascot-prop"><circle cx="75" cy="65" r="7" fill="#d9b54e" stroke="#826c31" /><path d="M71 71 l-1 9 5-3 5 3-2-9" fill="#d36b62" /></g> : null}
    </svg>
  );
}

export default function MascotSprite({ character = 'ivan', expression = 'neutral', pose = 'natural', gaze = 'forward', compact = false, eager = false, decorative = false }) {
  const mascot = character === 'till' ? 'till' : 'ivan';
  const safeExpression = isApprovedEmotion(mascot, expression) ? expression : 'neutral';
  return (
    <span className={`mascot-sprite is-${mascot} is-${safeExpression} pose-${pose} gaze-${gaze}${compact ? ' is-compact' : ''}`} data-character={mascot} data-expression={safeExpression}>
      <img src={`/mascots/${mascot}.webp`} alt={decorative ? '' : mascot === 'ivan' ? 'Иван' : 'Тилл'} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      <EmotionOverlay character={mascot} expression={safeExpression} />
    </span>
  );
}

export function preloadMascotSprites(lines = []) {
  if (typeof window === 'undefined') return;
  const characters = new Set(['ivan', 'till']);
  for (const line of Array.isArray(lines) ? lines : []) {
    if (line?.character === 'ivan' || line?.character === 'till') characters.add(line.character);
  }
  for (const character of characters) {
    const image = new Image();
    image.src = `/mascots/${character}.webp`;
  }
}
