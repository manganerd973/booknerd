import { notFound } from 'next/navigation';
import { getBookBySlug, getChapter, listChapters } from '../../../../../lib/books.js';
import { requireReaderAccess } from '../../../../../lib/reader-access.js';
import ReaderView from '../../../../../src/reader-view.jsx';

export const dynamic = 'force-dynamic';

export default async function ChapterPage({ params }) {
  const { slug, chapterId } = await params;
  await requireReaderAccess(`/books/${slug}/chapters/${chapterId}`);
  const [book, chapter] = await Promise.all([getBookBySlug(slug), getChapter(chapterId)]);
  if (!book || !chapter || chapter.bookId !== book.id) notFound();
  const chapters = await listChapters(book.id);
  const index = chapters.findIndex((item) => item.id === chapter.id);
  const previous = index > 0 ? chapters[index - 1] : null;
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;
  return <ReaderView book={book} chapter={chapter} chapters={chapters} previous={previous} next={next} />;
}
