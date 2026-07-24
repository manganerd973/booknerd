import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Clock3, ExternalLink, FileText, Flame } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getBookBySlug, listChapters } from '../../../lib/books.js';
import { listBookArtworks } from '../../../lib/artworks.js';
import { requireReaderAccess } from '../../../lib/reader-access.js';
import BookArtGallery from '../../../src/book-art-gallery.jsx';
import BookRating from '../../../src/book-rating.jsx';
import BookReviews from '../../../src/book-reviews.jsx';
import CommentsSection from '../../../src/comments-section.jsx';
import BookLibraryControl from '../../../src/reader-library.jsx';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params }) {
  const { slug } = await params;
  await requireReaderAccess(`/books/${slug}`);
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const [chapters, artworks] = await Promise.all([
    listChapters(book.id),
    listBookArtworks(book.id),
  ]);
  const heatGuide = chapters.filter((chapter) => Number(chapter.heatLevel || 0) > 0);
  const hasHotScenes = Boolean(book.hasHotScenes || heatGuide.length);
  const hotSceneChapters = book.hotSceneChapters
    || heatGuide.map((chapter) => chapter.heatPages || String(chapter.chapterNumber)).filter(Boolean).join(', ');

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
          {book.seriesTitle && <p className="book-series">Серия «{book.seriesTitle}»{book.seriesNumber ? ` · книга ${book.seriesNumber}` : ''}</p>}
          {book.dedication ? <blockquote className="book-dedication"><small>Посвящение</small><p>«{book.dedication}»</p></blockquote> : null}
          <div className="book-detail-progress">
            <div><span>Готовность перевода</span><strong>{book.progress}%</strong></div>
            <div><i style={{ width: `${book.progress}%` }} /></div>
          </div>
          <div className="book-detail-genres">{book.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
          {(book.tropes || []).length ? (
            <div className="book-detail-tropes">
              <small>Тропы</small>
              <div>{book.tropes.map((trope) => <span key={trope}>{trope}</span>)}</div>
            </div>
          ) : null}
          <div className="book-detail-actions">
            {chapters[0] ? <a className="editorial-primary" href={`/books/${book.slug}/chapters/${chapters[0].id}`}>Начать читать <ArrowRight size={18} /></a> : <span className="book-coming-soon"><Clock3 size={18} /> Первая глава готовится</span>}
            {book.driveUrl ? <a className="editorial-drive-link" href={book.driveUrl} target="_blank" rel="noreferrer">Файл книги в Google Drive <ExternalLink size={16} /></a> : null}
          </div>
          <BookLibraryControl bookId={book.id} />
          <BookRating bookId={book.id} />
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
                  <div><strong>{chapter.title}</strong><small><FileText size={13} /> {chapter.pointOfView ? `От лица ${chapter.pointOfView}` : 'Опубликована'}</small></div>
                  <ArrowRight size={18} />
                </a>
              ))}
            </div>
          ) : (
            <div className="chapter-empty"><BookOpen size={30} /><p>Опубликованных глав пока нет.</p></div>
          )}
        </aside>
      </section>

      {(book.triggerWarnings || []).length ? (
        <section className="book-trigger-warnings" aria-labelledby="book-trigger-warnings-title">
          <div>
            <AlertTriangle size={23} />
            <div><span className="editorial-section-number">03 / БЕРЕЖНО К СЕБЕ</span><h2 id="book-trigger-warnings-title">Предупреждения о триггерах</h2></div>
          </div>
          <p>Перед чтением обратите внимание: в книге встречаются темы, которые могут быть чувствительными.</p>
          <div>{book.triggerWarnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
        </section>
      ) : null}

      <section className="book-heat-guide" aria-labelledby="book-heat-guide-title">
        <div className="book-heat-guide-heading">
          <div>
            <span className="editorial-section-number">03 / ПУТЕВОДИТЕЛЬ ПО ГЛАВАМ</span>
            <h2 id="book-heat-guide-title">Горячие сцены — по желанию</h2>
          </div>
          <Flame size={34} />
        </div>
        <p>Это небольшой путеводитель по главам для любителей горячих сцен, а также для тех, кто предпочитает их избегать.</p>
        <div className="book-heat-summary">
          <div><span>Горячие сцены</span><strong>{hasHotScenes ? 'Да' : 'Нет'}</strong></div>
          {hasHotScenes && hotSceneChapters ? <div><span>Главы со сценами</span><strong>{hotSceneChapters}</strong></div> : null}
        </div>
        {heatGuide.length ? (
          <div className="book-heat-guide-list">
            {heatGuide.map((chapter) => (
              <a href={`/books/${book.slug}/chapters/${chapter.id}`} key={chapter.id}>
                <span>Глава {chapter.chapterNumber}</span>
                <strong>{chapter.title}</strong>
                {chapter.heatPages ? <small>главы {chapter.heatPages}</small> : null}
                <em aria-label={`Уровень горячих сцен: ${chapter.heatLevel} из 3`}>{'🔥'.repeat(chapter.heatLevel)}</em>
                <ArrowRight size={17} />
              </a>
            ))}
          </div>
        ) : (
          !hasHotScenes ? <div className="book-heat-guide-empty"><span>♡</span><p>В книге нет горячих сцен.</p></div> : null
        )}
      </section>

      <BookArtGallery artworks={artworks} bookTitle={book.title} />

      <BookReviews bookId={book.id} />

      <CommentsSection bookId={book.id} />
    </main>
  );
}
