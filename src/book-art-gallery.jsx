'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';

export default function BookArtGallery({ artworks = [], bookTitle = '' }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const activeArtwork = activeIndex == null ? null : artworks[activeIndex];

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

  if (!artworks.length) return null;

  return (
    <section className="book-art-section" aria-labelledby="book-art-title">
      <div className="book-art-heading">
        <div><span className="editorial-section-number">03 / АРТЫ К КНИГЕ</span><h2 id="book-art-title">Заглянуть в историю</h2></div>
        <p>Атмосфера, герои и места из мира «{bookTitle}».</p>
      </div>
      <div className={`book-art-grid ${artworks.length === 1 ? 'is-single' : ''}`}>
        {artworks.map((artwork, index) => (
          <button type="button" key={artwork.id} onClick={() => setActiveIndex(index)} aria-label={`Открыть арт ${index + 1}`}>
            <img src={artwork.imageUrl} alt={artwork.caption || `Арт к книге «${bookTitle}»`} loading="lazy" />
            <span><small>{String(index + 1).padStart(2, '0')}</small><strong>{artwork.caption || bookTitle}</strong><Expand size={17} /></span>
          </button>
        ))}
      </div>

      {activeArtwork && (
        <div className="book-art-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр арта" onClick={() => setActiveIndex(null)}>
          <button className="book-art-close" type="button" onClick={() => setActiveIndex(null)} aria-label="Закрыть"><X size={25} /></button>
          {artworks.length > 1 && <button className="book-art-previous" type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex - 1 + artworks.length) % artworks.length); }} aria-label="Предыдущий арт"><ChevronLeft size={28} /></button>}
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={activeArtwork.imageUrl} alt={activeArtwork.caption || `Арт к книге «${bookTitle}»`} />
            <figcaption><span>{activeIndex + 1} / {artworks.length}</span><strong>{activeArtwork.caption || bookTitle}</strong></figcaption>
          </figure>
          {artworks.length > 1 && <button className="book-art-next" type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex + 1) % artworks.length); }} aria-label="Следующий арт"><ChevronRight size={28} /></button>}
        </div>
      )}
    </section>
  );
}
