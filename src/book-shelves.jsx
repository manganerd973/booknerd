import { uniqueGenres, hasGenre } from '../lib/genres.js';
import React from 'react';
import { Star } from 'lucide-react';

const newest = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

export function booksForShelf(books, shelf) {
  if (shelf === 'new') return [...books].sort(newest);
  if (shelf === 'finished') return books.filter((book) => book.status === 'Завершено');
  if (shelf === 'rated') return books.filter((book) => book.ratingAverage != null).sort((a, b) => b.ratingAverage - a.ratingAverage);
  if (shelf === 'recommended') return books.filter((book) => book.publishedChapterCount > 0).sort((a, b) =>
    Number(Boolean(b.teamPick)) - Number(Boolean(a.teamPick)) || (b.ratingAverage ?? -1) - (a.ratingAverage ?? -1));
  return books;
}

export function bookCollections(books) {
  const genres = uniqueGenres(books.flatMap((book) => book.genres || []));
  return [
    { key: 'recommended', title: 'С чего начать', description: 'Выбор команды и книги с высокими оценками.', books: booksForShelf(books, 'recommended') },
    { key: 'finished', title: 'Читать до финала', description: 'Переводы, которые уже завершены.', books: booksForShelf(books, 'finished') },
    ...genres.map((genre) => ({ key: `genre:${genre}`, title: genre, description: '', books: books.filter((book) => hasGenre(book.genres, genre)) })),
  ].filter((collection) => collection.books.length);
}

export function BookArtwork({ book }) {
  return book.coverUrl
    ? <img src={book.coverUrl} alt="" loading="lazy" />
    : <span className="shelf-cover-fallback">{book.title}</span>;
}

export function ShelfBook({ book, overlay = false, badge }) {
  return (
    <a className={`shelf-book ${overlay ? 'shelf-book-overlay' : ''}`} href={`/books/${book.slug}`}>
      <div className="shelf-book-art">
        <BookArtwork book={book} />
        {badge && <span className="shelf-status">{badge}</span>}
        {book.ratingAverage != null && <span className="shelf-rating" aria-label={`Оценка ${book.ratingAverage} из 10`}><Star size={12} />{book.ratingAverage.toLocaleString('ru', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>}
      </div>
      <div className="shelf-book-caption"><strong>{book.title}</strong><small>{book.genre || book.author}{book.publishedChapterCount > 0 ? ` · ${book.publishedChapterCount} гл.` : ''}</small></div>
    </a>
  );
}

export function CollectionTile({ collection }) {
  return (
    <a className="shelf-collection" href={`/translations?collection=${encodeURIComponent(collection.key)}`}>
      <div className="shelf-mosaic" style={{ '--mosaic-count': Math.min(4, collection.books.length) }}>
        {collection.books.slice(0, 4).map((book) => <BookArtwork key={book.id} book={book} />)}
      </div>
      <strong>{collection.title}</strong>
      {collection.description && <small>{collection.description}</small>}
      <small>Книг: {collection.books.length}</small>
    </a>
  );
}

export function HomeShelves({ books, libraryByBook }) {
  const collections = bookCollections(books);
  const recommended = booksForShelf(books, 'recommended');
  const orderedRecommendations = [
    ...recommended.filter((book) => !libraryByBook.has(book.id)),
    ...recommended.filter((book) => libraryByBook.has(book.id)),
  ];
  return [
    ['recommended', 'Рекомендуем вам', orderedRecommendations],
    ['collections', 'Подборки', collections],
    ['new', 'Новинки', booksForShelf(books, 'new')],
    ['finished', 'Завершённые', booksForShelf(books, 'finished')],
  ].map(([key, title, items]) => (
    <section className="section shelf-section" key={key} aria-labelledby={`shelf-${key}`}>
      <div className="home-section-heading"><h2 id={`shelf-${key}`}>{title}</h2><a href={`/translations?view=${key}`}>Все <span className="visually-hidden"> — {title}</span></a></div>
      {items.length ? <div className={`shelf-row ${key === 'collections' ? 'shelf-row-collections' : ''}`} role="region" aria-label={title} tabIndex={0}>
        {items.slice(0, 9).map((item) => key === 'collections'
          ? <CollectionTile key={item.key} collection={item} />
          : <ShelfBook key={item.id} book={item} />)}
      </div> : <p className="home-empty">{key === 'finished' ? 'Завершённые переводы появятся здесь.' : 'Книги появятся здесь после публикации.'}</p>}
    </section>
  ));
}
