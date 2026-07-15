import { ArrowLeft, ArrowRight, BookOpen, Clock3, FileText } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getBookBySlug, listChapters } from '../../../lib/books.js';
import { requireReaderAccess } from '../../../lib/reader-access.js';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params }) {
  const { slug } = await params;
  await requireReaderAccess(`/books/${slug}`);
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const chapters = await listChapters(book.id);

  return (
    <main className="editorial-page">
      <header className="editorial-header">
        <a className="editorial-brand" href="/"><span>B</span><strong>BOOKNERD.</strong></a>
        <a href="/#catalog"><ArrowLeft size={17} /> К библиотеке</a>
      </header>

      <section className="book-detail-hero">
        <div className="book-detail-cover">
          {book.coverUrl ? <img src={book.coverUrl} alt={`Обложка книги «${book.title}»`} /> : <><span>перевод booknerd</span><strong>{book.title}</strong><small>{book.author}</small></>}
        </div>
        <div className="book-detail-copy">
          <span className="editorial-kicker">{book.status} · {book.genre}</span>
          <h1>{book.title}</h1>
          <p className="book-detail-author">{book.author}</p>
          {book.originalTitle && <p className="book-original-title">Оригинальное название: {book.originalTitle}</p>}
          <div className="book-detail-progress">
            <div><span>Готовность перевода</span><strong>{book.progress}%</strong></div>
            <div><i style={{ width: `${book.progress}%` }} /></div>
          </div>
          <div className="book-detail-genres">{book.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
          {chapters[0] ? <a className="editorial-primary" href={`/books/${book.slug}/chapters/${chapters[0].id}`}>Начать читать <ArrowRight size={18} /></a> : <span className="book-coming-soon"><Clock3 size={18} /> Первая глава готовится</span>}
        </div>
      </section>

      <section className="book-detail-body">
        <article className="book-synopsis">
          <span className="editorial-section-number">01 / АННОТАЦИЯ</span>
          <h2>Об этой истории</h2>
          <p>{book.synopsis || 'Аннотация появится совсем скоро.'}</p>
        </article>

        <aside className="chapter-catalog">
          <span className="editorial-section-number">02 / ГЛАВЫ</span>
          <div className="chapter-catalog-title"><h2>Читать перевод</h2><span>{chapters.length}</span></div>
          {chapters.length ? (
            <div className="chapter-links">
              {chapters.map((chapter) => (
                <a href={`/books/${book.slug}/chapters/${chapter.id}`} key={chapter.id}>
                  <span>{String(chapter.chapterNumber).padStart(2, '0')}</span>
                  <div><strong>{chapter.title}</strong><small><FileText size={13} /> Опубликована</small></div>
                  <ArrowRight size={18} />
                </a>
              ))}
            </div>
          ) : (
            <div className="chapter-empty"><BookOpen size={30} /><p>Опубликованных глав пока нет.</p></div>
          )}
        </aside>
      </section>
    </main>
  );
}
