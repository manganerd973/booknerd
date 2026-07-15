import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getBookBySlug, getChapter, listChapters } from '../../../../../lib/books.js';

export const dynamic = 'force-dynamic';

export default async function ChapterPage({ params }) {
  const { slug, chapterId } = await params;
  const [book, chapter] = await Promise.all([getBookBySlug(slug), getChapter(chapterId)]);
  if (!book || !chapter || chapter.bookId !== book.id) notFound();
  const chapters = await listChapters(book.id);
  const index = chapters.findIndex((item) => item.id === chapter.id);
  const previous = index > 0 ? chapters[index - 1] : null;
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;

  return (
    <main className="reader-page">
      <header className="reader-header">
        <a className="editorial-brand" href="/"><span>B</span><strong>BOOKNERD.</strong></a>
        <a href={`/books/${book.slug}`}><BookOpen size={17} /> О книге</a>
      </header>

      <article className="reader-article">
        <a className="reader-back" href={`/books/${book.slug}`}><ArrowLeft size={17} /> Все главы</a>
        <span className="editorial-kicker">{book.title}</span>
        <h1><small>Глава {chapter.chapterNumber}</small>{chapter.title}</h1>
        <div className="reader-rule"><span>✦</span></div>
        <div className="reader-text">{chapter.body || 'Текст этой главы готовится к публикации.'}</div>
      </article>

      <nav className="reader-navigation" aria-label="Навигация по главам">
        {previous ? <a href={`/books/${book.slug}/chapters/${previous.id}`}><ArrowLeft size={18} /><span><small>Предыдущая</small><strong>{previous.title}</strong></span></a> : <span />}
        {next ? <a href={`/books/${book.slug}/chapters/${next.id}`}><span><small>Следующая</small><strong>{next.title}</strong></span><ArrowRight size={18} /></a> : <a href={`/books/${book.slug}`}><span><small>Конец</small><strong>Вернуться к книге</strong></span><BookOpen size={18} /></a>}
      </nav>
    </main>
  );
}
