import { genreKey } from '../../../../../lib/genres.js';
import { env } from 'cloudflare:workers';
import { notFound } from 'next/navigation';
import { getBookBySlug, getChapter, listChapters, listPublicBooks } from '../../../../../lib/books.js';
import { requireReaderAccess } from '../../../../../lib/reader-access.js';
import { getSupportCard } from '../../../../../lib/support.js';
import { countChapterComments } from '../../../../../lib/comments.js';
import ReaderView from '../../../../../src/reader-view.jsx';

export const dynamic = 'force-dynamic';

export default async function ChapterPage({ params }) {
  const { slug, chapterId } = await params;
  await requireReaderAccess(`/books/${slug}/chapters/${chapterId}`);
  const [book, chapter] = await Promise.all([getBookBySlug(slug), getChapter(chapterId)]);
  if (!book || !chapter || chapter.bookId !== book.id) notFound();
  const [chapters, catalog, supportCard, initialCommentCount] = await Promise.all([
    listChapters(book.id),
    listPublicBooks().catch(() => []),
    getSupportCard().catch(() => ''),
    countChapterComments(book.id, chapter.id).catch(() => null),
  ]);
  const genres = new Set((book.genres || []).map(genreKey));
  const related = catalog.filter((item) => item.id !== book.id && item.publishedChapterCount > 0);
  const similarity = (item) => (item.genres || []).filter((genre) => genres.has(genreKey(genre))).length;
  const toCard = ({ id, slug, title, coverUrl, genre, publishedChapterCount, ratingAverage, ageRating }) => ({ id, slug, title, coverUrl, genre, publishedChapterCount, ratingAverage, ageRating });
  const similar = related.filter((item) => similarity(item) > 0).sort((a, b) => similarity(b) - similarity(a)).slice(0, 6).map(toCard);
  const recommendations = [...related].sort((a, b) => Number(Boolean(b.teamPick)) - Number(Boolean(a.teamPick)) ||
    (b.ratingAverage ?? -1) - (a.ratingAverage ?? -1)).slice(0, 6).map(toCard);
  const supportLinks = [
    ['Донат по СБП', env.BOOKNERD_SBP_URL],
    ['Boosty', env.BOOKNERD_BOOSTY_URL],
  ].flatMap(([label, url]) => {
    try {
      const target = new URL(url);
      return target.protocol === 'https:' ? [{ label, url: target.href }] : [];
    } catch { return []; }
  });
  const index = chapters.findIndex((item) => item.id === chapter.id);
  const previous = index > 0 ? chapters[index - 1] : null;
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;
  return <ReaderView book={book} chapter={chapter} chapters={chapters} previous={previous} next={next} recommendations={recommendations} similar={similar} supportLinks={supportLinks} supportCard={supportCard} initialCommentCount={initialCommentCount} />;
}
