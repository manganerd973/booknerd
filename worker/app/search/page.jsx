import { listPublicBooks } from '../../lib/books.js';
import { requireReaderAccess } from '../../lib/reader-access.js';
import { ensureDb } from '../../lib/runtime.js';
import AdvancedSearchPage from '../../src/advanced-search-page.jsx';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireReaderAccess('/search');
  const books = await listPublicBooks();
  const db = await ensureDb();
  const glossary = await db.prepare(`SELECT g.book_id, g.name, g.description, g.connections FROM book_glossary g JOIN books b ON b.id = g.book_id WHERE b.published = 1`).all();
  const aliasesByBook = new Map();
  for (const entry of glossary.results || []) {
    const current = aliasesByBook.get(entry.book_id) || [];
    current.push(entry.name, entry.description, entry.connections);
    aliasesByBook.set(entry.book_id, current.filter(Boolean));
  }
  return <AdvancedSearchPage books={books.map((book) => ({ ...book, searchAliases: [...(book.searchAliases || []), ...(aliasesByBook.get(book.id) || [])] }))} />;
}
