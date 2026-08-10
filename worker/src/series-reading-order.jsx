import React from 'react';
import { ArrowLeft, ArrowRight, BookCopy, Check, Sparkles } from 'lucide-react';

export default function SeriesReadingOrder({ book, seriesBooks = [] }) {
  const automatic = seriesBooks.map((item, index) => ({
    id: item.id,
    order: item.seriesNumber || index + 1,
    title: item.title,
    kind: 'main',
    translated: item.published,
    bookSlug: item.slug,
  }));
  const items = (book.seriesReadingOrder?.length ? book.seriesReadingOrder : automatic)
    .slice()
    .sort((left, right) => Number(left.order) - Number(right.order));
  if (!book.seriesTitle || items.length < 2) return null;
  const currentIndex = items.findIndex((item) => item.bookSlug === book.slug || item.title === book.title);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  return (
    <section className="series-reading-order">
      <div className="series-reading-heading">
        <BookCopy size={31} />
        <div><span className="editorial-section-number">ПОРЯДОК ЧТЕНИЯ СЕРИИ</span><h2>{book.seriesTitle}</h2><p>Основные части, дополнительные рассказы и переводы BOOKNERD — по порядку.</p></div>
      </div>
      <div className="series-neighbours">
        {previous ? <a href={previous.bookSlug ? `/books/${previous.bookSlug}` : '#series-order'}><ArrowLeft size={17} /><span><small>Предыдущая часть</small><strong>{previous.title}</strong></span></a> : <span />}
        {next ? <a href={next.bookSlug ? `/books/${next.bookSlug}` : '#series-order'}><span><small>Следующая часть</small><strong>{next.title}</strong></span><ArrowRight size={17} /></a> : null}
      </div>
      <ol id="series-order">
        {items.map((item, index) => {
          const current = index === currentIndex;
          const content = (
            <>
              <span>{String(item.order || index + 1).padStart(2, '0')}</span>
              <div><strong>{item.title}</strong><small>{item.kind === 'extra' ? <><Sparkles size={13} /> Дополнительный рассказ</> : 'Основная часть серии'}</small></div>
              <em className={item.translated ? 'is-translated' : ''}>{item.translated ? <><Check size={13} /> Переведено BOOKNERD</> : 'Ещё не переведено'}</em>
              {current ? <b>Вы здесь</b> : null}
            </>
          );
          return <li className={current ? 'is-current' : ''} key={item.id || `${item.title}-${index}`}>{item.bookSlug ? <a href={`/books/${item.bookSlug}`}>{content}</a> : <div>{content}</div>}</li>;
        })}
      </ol>
    </section>
  );
}
