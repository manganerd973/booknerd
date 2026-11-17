'use client';
import React, { useState } from 'react';
export default function WorldMapViewer({ url, title }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className="reader-world-map-viewer">
    <div className="reader-map-controls"><button onClick={() => setZoom(Math.max(1, zoom - .5))} disabled={zoom <= 1} aria-label="Уменьшить карту">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(Math.min(4, zoom + .5))} disabled={zoom >= 4} aria-label="Увеличить карту">+</button><button onClick={() => setZoom(1)}>Сбросить</button></div>
    {failed ? <p role="alert">Не удалось загрузить карту. <button onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Повторить</button></p> : <div className="reader-map-scroll"><img key={attempt} src={url} alt={`Карта мира книги «${title}»`} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} onError={() => setFailed(true)} /></div>}
    <small>Увеличьте карту кнопкой «+» и перемещайте её прокруткой. После закрытия вы вернётесь к чтению.</small>
  </div>;
}
