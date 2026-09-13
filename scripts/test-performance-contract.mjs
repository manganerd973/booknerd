import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const books = read('lib/books.js');
const bookPage = read('app/books/[slug]/page.jsx');
const chapterPage = read('app/books/[slug]/chapters/[chapterId]/page.jsx');
const reader = read('src/reader-view.jsx');
const serviceWorker = read('public/sw.js');
const runtime = read('lib/runtime.js');
const migration = read('.openai/drizzle/0027_app_schema_marker.sql');

assert.match(books, /export async function listChapterSummaries/);
assert.match(bookPage, /listChapterSummaries\(book\.id\)/);
assert.match(chapterPage, /listChapterSummaries\(book\.id\)/);
assert.doesNotMatch(bookPage, /listChapters\(book\.id\)/);
assert.doesNotMatch(chapterPage, /listChapters\(book\.id\)/);

assert.match(reader, /\[chapter\]\.map/);
assert.match(reader, /\/chapter-search\?/);
assert.match(reader, /item\.id === chapter\.id \? \{ \.\.\.item, \.\.\.chapter \} : item/);

assert.match(serviceWorker, /booknerd-shell-v53/);
assert.doesNotMatch(serviceWorker, /REACTION_STICKER_URLS/);
assert.doesNotMatch(serviceWorker, /const PRELOAD_URLS = \[[^\n]*'\/profile'/);
assert.match(serviceWorker, /includeImages: true/);

assert.match(runtime, /const SCHEMA_VERSION = 53/);
assert.match(runtime, /SELECT version FROM app_schema/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS app_schema/);
assert.match(migration, /ON CONFLICT\(id\) DO UPDATE/);

console.log('V53 performance contract: OK');
