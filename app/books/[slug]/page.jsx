import BookContentTabs from '../../../src/book-content-tabs.jsx';
import { AlertTriangle, ArrowRight, BookOpen, Clock3, ExternalLink, FileText, Flame, Heart, MessageCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getBookBySlug, listChapterSummaries, listPublicBooks } from '../../../lib/books.js';
import { listBookArtworks } from '../../../lib/artworks.js';
import { requireReaderAccess } from '../../../lib/reader-access.js';
import BookArtGallery from '../../../src/book-art-gallery.jsx';
import BookRating from '../../../src/book-rating.jsx';
import WorldMapViewer from '../../../src/world-map-viewer.jsx';
import { genreKey } from '../../../lib/genres.js';
import CommentsSection from '../../../src/comments-section.jsx';
import BookLibraryControl from '../../../src/reader-library.jsx';
import BookGlossary from '../../../src/book-glossary.jsx';
import OfflineBookButton from '../../../src/offline-book-button.jsx';
import { SiteHeader } from '../../../src/page-chrome.jsx';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params }) {
  const { slug } = await params;
  await requireReaderAccess(`/books/${slug}`);
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const [chapters, artworks, publicBooks] = await Promise.all([
    listChapterSummaries(book.id),
    listBookArtworks(book.id),
    listPublicBooks(),
  ]);
  const isStandalone = !book.seriesTitle || /^(одиночка|standalone)$/i.test(book.seriesTitle.trim());
  const uniqueTags = values => [...new Map((values || []).map(v => [genreKey(v), v])).values()];
  const similarBooks = publicBooks.filter(item => item.id !== book.id && (item.genres || []).some(g => (book.genres || []).some(own => genreKey(g) === genreKey(own)))).slice(0, 6);
  const heatGuide = chapters.filter((chapter) => Number(chapter.heatLevel || 0) > 0);
  const hasHotScenes = Boolean(book.hasHotScenes || heatGuide.length);
  const hotSceneChapters = book.hotSceneChapters
    || heatGuide.map((chapter) => chapter.heatPages || String(chapter.chapterNumber)).filter(Boolean).join(', ');

  const synopsis = book.synopsis?.trim();
  const shortSynopsis = synopsis?.length > 280 ? `${synopsis.slice(0, 280).trimEnd()}…` : null;
  const facts = [
    ['Перевод', book.status],
    ['Глав опубликовано', chapters.length],
    ['Год', book.publicationYear],
    ['Страна', book.country],
    ['Страниц в оригинале', book.pageCount],
  ].filter(([label, value]) => label === 'Глав опубликовано' || Boolean(value));

  return (
    <main className="editorial-page shelf-page book-page-modern">
      <SiteHeader compact />

      <section className="book-detail-hero">
        <div className="book-detail-cover">
          {book.coverUrl ? <img src={book.coverUrl} alt={`Обложка книги «${book.title}»`} /> : <><span>перевод booknerd</span><strong>{book.title}</strong><small>{book.author}</small></>}
        </div>
        <div className="book-detail-copy">
          <h1>{book.title}</h1>
          <p className="book-detail-author">{book.author}</p>
          {book.originalTitle && <p className="book-original-title">{book.originalTitle}</p>}
          <p className="book-series">{isStandalone ? 'Одиночная книга' : <>Серия «{book.seriesTitle}»{book.seriesNumber ? ` · книга ${book.seriesNumber}` : ''}</>}</p>
          <div className="book-description">
            {shortSynopsis ? <>
              <p className="book-description-preview">{shortSynopsis}</p>
              <details><summary>Читать полностью</summary><p>{synopsis}</p></details>
            </> : <p>{synopsis || 'Аннотация пока не добавлена.'}</p>}
          </div>
          <div className="book-detail-actions">
            {chapters[0] ? <a className="editorial-primary" href={`/books/${book.slug}/chapters/${chapters[0].id}`}><BookOpen size={18} /> Читать с начала</a> : <span className="book-coming-soon"><Clock3 size={18} /> Первая глава готовится</span>}
            {book.driveUrl ? <a className="editorial-drive-link" href={book.driveUrl} target="_blank" rel="noreferrer">Файл книги в Google Drive <ExternalLink size={16} /></a> : null}
            {book.playlistUrl ? <a className="editorial-drive-link" href={book.playlistUrl} target="_blank" rel="noreferrer">Музыкальный плейлист книги <ExternalLink size={16} /></a> : null}
          </div>
          <BookLibraryControl bookId={book.id} />
          <dl className="book-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className="book-taxonomy">
            {[["Жанры", book.genres], ["Тропы", book.tropes]].map(([label, values]) => values?.length ? <section key={label}><h3>{label}</h3><div className="book-tag-list">{uniqueTags(values).map(value => <span key={genreKey(value)}>{value}</span>)}</div></section> : null)}
            {book.dedication && <section><h3>Посвящение</h3><p>{book.dedication}</p></section>}
            {book.triggerWarnings?.length > 0 && <details><summary>Триггеры</summary><div className="book-tag-list">{uniqueTags(book.triggerWarnings).map(value => <span key={genreKey(value)}>{value}</span>)}</div></details>}
          </div>
          <BookRating bookId={book.id} />
          <OfflineBookButton book={book} chapters={chapters} />
        </div>
      </section>

      <BookContentTabs
        chaptersContent={<>      <section className="book-detail-body">
        <aside className="chapter-catalog">
          <div className="chapter-catalog-title"><h2>Оглавление</h2><span>{chapters.length}</span></div>
          {chapters.length ? (
            <div className="chapter-links">
              {chapters.map((chapter) => (
                <a href={`/books/${book.slug}/chapters/${chapter.id}`} key={chapter.id}>
                  <span>{String(chapter.chapterNumber).padStart(2, '0')}</span>
                  <div><strong>{chapter.title}</strong><small className="chapter-social-counts"><span aria-label="Сердечки"><Heart size={14} /> {chapter.likeCount || 0}</span><span aria-label="Комментарии"><MessageCircle size={14} /> {chapter.commentCount || 0}</span></small></div>
                  <ArrowRight size={18} />
                </a>
              ))}
            </div>
          ) : (
            <div className="chapter-empty"><BookOpen size={30} /><p>Опубликованных глав пока нет.</p></div>
          )}
        </aside>
      </section></>}
        artContent={<BookArtGallery artworks={artworks} bookTitle={book.title} />}
        mapContent={book.worldMapUrl ? <WorldMapViewer url={book.worldMapUrl} title={book.title} /> : <p>Карта для этой книги пока не добавлена.</p>}
        commentsContent={<CommentsSection bookId={book.id} />}
      />

      <details className="book-extra-details"><summary>Словарь книги</summary><BookGlossary bookId={book.id} /></details>
      {hasHotScenes && <details className="book-extra-details"><summary>Главы с горячими сценами</summary><p>{hotSceneChapters || 'Информация уточняется.'}</p></details>}
      <section className="book-related"><h2>Похожие по жанрам</h2>
        {similarBooks.length ? <div className="book-related-grid">{similarBooks.map(item => <a key={item.id} href={`/books/${item.slug}`}>{item.coverUrl && <img src={item.coverUrl} alt="" loading="lazy" />}<strong>{item.title}</strong></a>)}</div> : <p>Похожие книги появятся по мере пополнения каталога.</p>}
        <a className="shelf-control" href="/discovery">Рекомендации и подборки →</a>
      </section>
    </main>
  );
}
