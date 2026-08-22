'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, LockKeyhole, MapPinned, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function BookWorldMap({ worldMap, currentChapter = 0 }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState(worldMap?.markers?.[0]?.id || null);
  const [expanded, setExpanded] = useState(false);
  const drag = useRef(null);
  const markers = worldMap?.markers || [];
  const selected = useMemo(() => markers.find((marker) => marker.id === selectedId) || null, [markers, selectedId]);
  const selectedLocked = Boolean(selected?.revealAfterChapter && currentChapter < selected.revealAfterChapter);

  useEffect(() => {
    if (!expanded) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);

  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  if (!worldMap?.imageUrl) return null;

  const changeZoom = (next) => {
    const value = clamp(next, 1, 4);
    setZoom(value);
    if (value === 1) setOffset({ x: 0, y: 0 });
  };
  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  const pointerDown = (event) => {
    if (event.target.closest('button')) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offset };
  };
  const pointerMove = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId || zoom <= 1) return;
    setOffset({
      x: drag.current.offset.x + event.clientX - drag.current.x,
      y: drag.current.offset.y + event.clientY - drag.current.y,
    });
  };
  const pointerEnd = (event) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  return (
    <div className={`book-world-map ${expanded ? 'is-expanded' : ''}`}>
      <div className="book-world-map-head">
        <div><Compass size={20} /><span><small>ИНТЕРАКТИВНАЯ КАРТА</small><strong>{worldMap.name || 'Карта мира'}</strong></span></div>
        <div className="book-world-map-controls" aria-label="Управление картой">
          <button type="button" onClick={() => changeZoom(zoom - 0.5)} disabled={zoom <= 1} aria-label="Уменьшить карту"><Minus size={17} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(zoom + 0.5)} disabled={zoom >= 4} aria-label="Увеличить карту"><Plus size={17} /></button>
          <button type="button" onClick={reset} aria-label="Вернуть исходный масштаб"><RotateCcw size={16} /></button>
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Закрыть полноэкранную карту' : 'Открыть карту на весь экран'}>{expanded ? <X size={18} /> : <Maximize2 size={17} />}</button>
        </div>
      </div>
      <div className="book-world-map-layout">
        <div
          className={`book-world-map-viewport ${zoom > 1 ? 'is-zoomed' : ''}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
          onWheel={(event) => { event.preventDefault(); changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25)); }}
        >
          <div className="book-world-map-canvas" style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`, '--map-zoom': zoom }}>
            <img src={worldMap.imageUrl} alt={worldMap.name || 'Карта мира книги'} draggable="false" />
            {markers.map((marker, index) => {
              const locked = Boolean(marker.revealAfterChapter && currentChapter < marker.revealAfterChapter);
              return <button
                className={`${selectedId === marker.id ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
                type="button"
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                onClick={() => setSelectedId(marker.id)}
                aria-label={locked ? `Закрытая локация, откроется после главы ${marker.revealAfterChapter}` : marker.name}
                key={marker.id}
              >{locked ? <LockKeyhole size={13} /> : <MapPinned size={15} />}<span>{index + 1}</span></button>;
            })}
          </div>
          <p className="book-world-map-hint">Используйте кнопки масштаба. Увеличенную карту можно перемещать пальцем или мышью.</p>
        </div>
        <aside className="book-world-map-locations">
          <header><small>ЛОКАЦИИ</small><strong>{markers.length || 'Без отметок'}</strong></header>
          {markers.length ? <div>{markers.map((marker, index) => {
            const locked = Boolean(marker.revealAfterChapter && currentChapter < marker.revealAfterChapter);
            return <button className={selectedId === marker.id ? 'is-active' : ''} type="button" onClick={() => setSelectedId(marker.id)} key={marker.id}><span>{locked ? <LockKeyhole size={12} /> : index + 1}</span><div><strong>{locked ? 'Неизвестная локация' : marker.name}</strong><small>{locked ? `Откроется после главы ${marker.revealAfterChapter}` : marker.description || 'Нажмите, чтобы найти на карте'}</small></div></button>;
          })}</div> : <p>Редакция пока не добавила описания локаций.</p>}
          {selected ? <article className={selectedLocked ? 'is-locked' : ''}>
            {selectedLocked ? <LockKeyhole size={21} /> : <MapPinned size={21} />}
            <small>{selectedLocked ? 'ЗАЩИТА ОТ СПОЙЛЕРОВ' : 'МЕСТО НА КАРТЕ'}</small>
            <h3>{selectedLocked ? 'Локация пока закрыта' : selected.name}</h3>
            <p>{selectedLocked ? `Описание откроется после прочтения главы ${selected.revealAfterChapter}.` : selected.description || 'Описание этой локации появится позже.'}</p>
          </article> : null}
        </aside>
      </div>
    </div>
  );
}
