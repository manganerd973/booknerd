'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Expand, Grid3X3, Images, List, X } from 'lucide-react';

const FANART_VIEW_KEY = 'booknerd-fanart-view-v1';

export default function BookArtGallery({ artworks = [], bookTitle = '' }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const activeArtwork = activeIndex == null ? null : artworks[activeIndex];

  useEffect(() => {
    try { setViewMode(localStorage.getItem(FANART_VIEW_KEY) === 'list' ? 'list' : 'grid'); } catch { /* optional */ }
  }, []);

  useEffect(() => {
    if (activeIndex == null) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowLeft') setActiveIndex((current) => (current - 1 + artworks.length) % artworks.length);
      if (event.key === 'ArrowRight') setActiveIndex((current) => (current + 1) % artworks.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, artworks.length]);

  const chooseView = (nextView) => {
    setViewMode(nextView);
    try { localStorage.setItem(FANART_VIEW_KEY, nextView); } catch { /* optional */ }
  };

  return (
    <section className="book-art-section" aria-labelledby="book-art-title">
      <div className="book-art-heading">
        <div><span className="editorial-section-number">04 / АРТЫ К КНИГЕ</span><h2 id="book-art-title">Заглянуть в историю</h2></div>
        <div className="book-art-heading-side"><p>Атмосфера, герои и места из мира «{bookTitle}».</p><div className="book-art-view-controls" role="group" aria-label="Вид фанартов"><button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => chooseView('grid')} aria-pressed={viewMode === 'grid'}><Grid3X3 size={17} /> Плитка</button><button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => chooseView('list')} aria-pressed={viewMode === 'list'}><List size={18} /> Список</button></div></div>
      </div>
      {artworks.length ? <div className={`book-art-grid is-${viewMode}`}>
        {artworks.map((artwork, index) => (
          <button type="button" key={artwork.id} onClick={() => setActiveIndex(index)} aria-label={`Открыть арт ${index + 1}`}>
            <img src={artwork.imageUrl} alt={artwork.caption || `Арт к книге «${bookTitle}»`} loading="lazy" />
            <span><small>{index === 0 ? 'АРТ ДНЯ' : index === 1 ? 'ФАНАРТ НЕДЕЛИ' : String(index + 1).padStart(2, '0')}</small><strong>{artwork.caption || bookTitle}</strong><Expand size={17} /></span>
          </button>
        ))}
      </div> : <div className="book-art-empty"><Images size={32} /><strong>Фанартов пока нет</strong><p>Когда команда добавит арты, они появятся здесь аккуратной галереей.</p></div>}

      {activeArtwork && (
        <div className="book-art-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр арта" onClick={() => setActiveIndex(null)}>
          <button className="book-art-close" type="button" onClick={() => setActiveIndex(null)} aria-label="Закрыть"><X size={25} /></button>
          {artworks.length > 1 && <button className="book-art-previous" type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex - 1 + artworks.length) % artworks.length); }} aria-label="Предыдущий арт"><ChevronLeft size={28} /></button>}
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={activeArtwork.imageUrl} alt={activeArtwork.caption || `Арт к книге «${bookTitle}»`} />
            <figcaption><span>{activeIndex + 1} / {artworks.length}</span><strong>{activeArtwork.caption || bookTitle}</strong><a href={activeArtwork.imageUrl} download><Download size={15} /> Скачать как обои</a></figcaption>
          </figure>
          {artworks.length > 1 && <button className="book-art-next" type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex + 1) % artworks.length); }} aria-label="Следующий арт"><ChevronRight size={28} /></button>}
        </div>
      )}
    </section>
  );
}
