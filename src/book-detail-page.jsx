'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock3,
  ExternalLink,
  FileText,
  Flame,
  Heart,
  MessageCircle,
  Star,
} from 'lucide-react';
import BookArtGallery from './book-art-gallery.jsx';
import BookRating from './book-rating.jsx';
import BookReviews from './book-reviews.jsx';
import CommentsSection from './comments-section.jsx';
import BookLibraryControl, { loadReaderLibrary } from './reader-library.jsx';
import BookGlossary from './book-glossary.jsx';
import SeriesReadingOrder from './series-reading-order.jsx';
import BookUniverse from './book-universe.jsx';
import OfflineBookButton from './offline-book-button.jsx';
import { MobileBottomNavigation } from './page-chrome.jsx';

const TABS = [
  ['about', 'О книге'],
  ['chapters', 'Главы'],
  ['comments', 'Комментарии'],
  ['discussion', 'Обсуждение'],
];

function PrimaryReadButton({ book, chapters }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadReaderLibrary()
      .then((items) => active && setItem(items.find((entry) => entry.bookId === book.id) || null))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [book.id]);

  const savedChapter = item?.lastChapterId ? chapters.find((chapter) => chapter.id === item.lastChapterId) : null;
  const targetChapter = savedChapter || chapters[0];
  if (!targetChapter) return <span className="book-primary-coming"><Clock3 size={19} /> Первая глава готовится</span>;
  const page = savedChapter ? Math.max(1, Number(item.lastPage || 0) + 1) : 1;
  const href = `/books/${book.slug}/chapters/${targetChapter.id}${savedChapter ? `?page=${page}` : ''}`;
  const label = loading ? 'Проверяем прогресс…' : savedChapter ? `Продолжить: глава ${savedChapter.chapterNumber}` : 'Начать читать';
  return <a className="book-primary-read" href={href}><BookOpen size={25} /> {label}<ArrowRight size={21} /></a>;
}

function BookFacts({ book, chapters }) {
  const plannedChapters = Math.max(0, Number(book.plannedChapterCount || 0));
  const publishedChapters = chapters.length;
  const chapterSummary = plannedChapters > publishedChapters
    ? `${publishedChapters} из ${plannedChapters} глав`
    : `${publishedChapters} глав`;
  const facts = [
    ['Тип', 'Роман'],
    ['Статус / перевод', `${book.status || 'Онгоинг'} · ${Math.max(0, Math.min(100, Number(book.progress || 0)))}%`],
    ['Выпуск', book.publicationYear ? `${book.publicationYear} г.` : 'Не указан'],
    ['Страна', book.country || 'Не указана'],
    ['Опубликовано', chapterSummary],
    ['Объём', book.pageCount ? `${book.pageCount} стр.` : 'Уточняется'],
  ];
  return <section className="book-facts-grid" aria-label="Основная информация о книге">{facts.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</section>;
}

function ChaptersPanel({ book, chapters }) {
  return (
    <section className="chapter-catalog book-tab-chapters">
      <span className="editorial-section-number">ОПУБЛИКОВАННЫЕ ГЛАВЫ</span>
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
      ) : <div className="chapter-empty"><BookOpen size={30} /><p>Опубликованных глав пока нет.</p></div>}
    </section>
  );
}

function AboutPanel({ book, chapters, artworks, seriesBooks }) {
  const heatGuide = chapters.filter((chapter) => Number(chapter.heatLevel || 0) > 0);
  const hasHotScenes = Boolean(book.hasHotScenes || heatGuide.length);
  const hotSceneChapters = book.hotSceneChapters || heatGuide.map((chapter) => chapter.heatPages || String(chapter.chapterNumber)).filter(Boolean).join(', ');

  return (
    <>
      <BookFacts book={book} chapters={chapters} />
      <section className="book-detail-body is-about-only">
        <article className="book-synopsis">
          <span className="editorial-section-number">01 / АННОТАЦИЯ</span><h2>Об этой истории</h2><p>{book.synopsis || 'Аннотация появится совсем скоро.'}</p>
          {book.dedication ? <blockquote className="book-dedication"><small>Посвящение</small><p>«{book.dedication}»</p></blockquote> : null}
          <div className="book-about-taxonomy">
            {(book.genres || []).length ? <div><small>Жанры</small><p>{book.genres.map((genre) => <span key={genre}>{genre}</span>)}</p></div> : null}
            {(book.tropes || []).length ? <div><small>Тропы</small><p>{book.tropes.map((trope) => <span key={trope}>{trope}</span>)}</p></div> : null}
          </div>
        </article>
      </section>
      <BookArtGallery artworks={artworks} bookTitle={book.title} />
      <SeriesReadingOrder book={book} seriesBooks={seriesBooks} />
      {(book.translator || book.editor || book.proofreader || book.quoteOfDay) ? (
        <section className="book-credits">
          <div><span className="editorial-section-number">НАД КНИГОЙ РАБОТАЛИ</span><h2>Команда перевода</h2></div>
          <div>{book.translator ? <article><small>Перевод</small><strong>{book.translator}</strong></article> : null}{book.editor ? <article><small>Редактура</small><strong>{book.editor}</strong></article> : null}{book.proofreader ? <article><small>Корректура</small><strong>{book.proofreader}</strong></article> : null}</div>
          {book.quoteOfDay ? <blockquote>«{book.quoteOfDay}»</blockquote> : null}
        </section>
      ) : null}
      <BookGlossary bookId={book.id} />
      <BookUniverse book={{ ...book, chapters }} />
      {(book.triggerWarnings || []).length ? (
        <section className="book-trigger-warnings" aria-labelledby="book-trigger-warnings-title">
          <div><AlertTriangle size={23} /><div><span className="editorial-section-number">БЕРЕЖНО К СЕБЕ</span><h2 id="book-trigger-warnings-title">Предупреждения о триггерах</h2></div></div>
          <p>Перед чтением обратите внимание: в книге встречаются темы, которые могут быть чувствительными.</p>
          <div>{book.triggerWarnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
        </section>
      ) : null}
      <section className="book-heat-guide" aria-labelledby="book-heat-guide-title">
        <div className="book-heat-guide-heading"><div><span className="editorial-section-number">ПУТЕВОДИТЕЛЬ ПО ГЛАВАМ</span><h2 id="book-heat-guide-title">Горячие сцены — по желанию</h2></div><Flame size={34} /></div>
        <p>Путеводитель для любителей горячих сцен, а также для тех, кто предпочитает их избегать.</p>
        <div className="book-heat-summary"><div><span>Горячие сцены</span><strong>{hasHotScenes ? 'Да' : 'Нет'}</strong></div>{hasHotScenes && hotSceneChapters ? <div><span>Главы со сценами</span><strong>{hotSceneChapters}</strong></div> : null}</div>
        {heatGuide.length ? <div className="book-heat-guide-list">{heatGuide.map((chapter) => <a href={`/books/${book.slug}/chapters/${chapter.id}`} key={chapter.id}><span>Глава {chapter.chapterNumber}</span><strong>{chapter.title}</strong>{chapter.heatPages ? <small>главы {chapter.heatPages}</small> : null}<em aria-label={`Уровень горячих сцен: ${chapter.heatLevel} из 3`}>{'🔥'.repeat(chapter.heatLevel)}</em><ArrowRight size={17} /></a>)}</div> : !hasHotScenes ? <div className="book-heat-guide-empty"><span>♡</span><p>В книге нет горячих сцен.</p></div> : null}
      </section>
    </>
  );
}

export default function BookDetailPage({ book, chapters = [], artworks = [], seriesBooks = [] }) {
  const [activeTab, setActiveTab] = useState('about');
  const badges = useMemo(() => [book.genre, book.publicationYear, book.status].filter(Boolean), [book.genre, book.publicationYear, book.status]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('comment-')) setActiveTab('comments');
    else if (TABS.some(([value]) => value === hash)) setActiveTab(hash);
  }, []);

  const selectTab = (nextTab) => {
    setActiveTab(nextTab);
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#${nextTab}`);
    window.requestAnimationFrame(() => document.getElementById('book-information')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <main className="editorial-page book-profile-page">
      <header className="editorial-header book-profile-header"><a className="editorial-brand" href="/"><span>B</span><strong>BOOKNERD.</strong></a><a href="/translations"><ArrowLeft size={17} /> К каталогу</a></header>
      <section className="book-detail-hero book-profile-hero">
        <div className="book-detail-cover">{book.coverUrl ? <img src={book.coverUrl} alt={`Обложка книги «${book.title}»`} /> : <><span>перевод booknerd</span><strong>{book.title}</strong><small>{book.author}</small></>}</div>
        <div className="book-detail-copy">
          <span className="editorial-kicker">BOOKNERD / {book.genre || 'РОМАН'}</span>
          <h1>{book.title}</h1>
          <p className="book-detail-author">{book.author}</p>
          {book.originalTitle ? <p className="book-original-title"><span>Оригинальное название</span>{book.originalTitle}</p> : null}
          {book.seriesTitle ? <p className="book-series">Серия «{book.seriesTitle}»{book.seriesNumber ? ` · книга ${book.seriesNumber}` : ''}</p> : null}
          <div className="book-profile-badges">{badges.map((badge) => <span key={badge}>{badge}</span>)}<span className="is-releasing"><i /> {book.status === 'Завершено' ? 'Завершено' : 'Выходит'}</span></div>
          <div className="book-profile-stats"><span><BookOpen size={17} /><strong>{chapters.length}</strong> глав</span><span><Star size={17} /><strong>{book.progress || 0}%</strong> переведено</span>{book.pageCount ? <span><FileText size={17} /><strong>{book.pageCount}</strong> страниц</span> : null}</div>
          <BookRating bookId={book.id} />
          <PrimaryReadButton book={book} chapters={chapters} />
          <div className="book-profile-secondary"><BookLibraryControl bookId={book.id} /><OfflineBookButton book={book} chapters={chapters} />{book.driveUrl ? <a className="editorial-drive-link" href={book.driveUrl} target="_blank" rel="noreferrer">Файл книги <ExternalLink size={16} /></a> : null}</div>
        </div>
      </section>
      <nav id="book-information" className="book-information-tabs" aria-label="Разделы страницы книги" role="tablist">
        {TABS.map(([value, label]) => <button type="button" id={`book-tab-${value}`} className={activeTab === value ? 'is-active' : ''} onClick={() => selectTab(value)} aria-controls="book-tab-content" aria-selected={activeTab === value} role="tab" key={value}>{value === 'about' ? <Heart size={17} /> : value === 'chapters' ? <BookOpen size={17} /> : value === 'comments' ? <MessageCircle size={17} /> : <Star size={17} />}{label}{value === 'chapters' ? <span>{chapters.length}</span> : null}</button>)}
      </nav>
      <section id="book-tab-content" className="book-tab-panel" role="tabpanel" aria-labelledby={`book-tab-${activeTab}`}>
        {activeTab === 'about' ? <AboutPanel book={book} chapters={chapters} artworks={artworks} seriesBooks={seriesBooks} /> : null}
        {activeTab === 'chapters' ? <ChaptersPanel book={book} chapters={chapters} /> : null}
        {activeTab === 'comments' ? <CommentsSection bookId={book.id} /> : null}
        {activeTab === 'discussion' ? <BookReviews bookId={book.id} /> : null}
      </section>
      <MobileBottomNavigation active="translations" />
    </main>
  );
}
