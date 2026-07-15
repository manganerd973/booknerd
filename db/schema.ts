import { blob, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  originalTitle: text('original_title').notNull().default(''),
  seriesTitle: text('series_title').notNull().default(''),
  seriesNumber: integer('series_number'),
  author: text('author').notNull(),
  synopsis: text('synopsis').notNull().default(''),
  genres: text('genres').notNull().default('[]'),
  status: text('status').notNull().default('Черновик'),
  progress: integer('progress').notNull().default(0),
  coverKey: text('cover_key'),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('books_slug_unique').on(table.slug),
]);

export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapter_number').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  status: text('status').notNull().default('draft'),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('chapters_book_number_unique').on(table.bookId, table.chapterNumber),
]);

export const adminUsers = sqliteTable('admin_users', {
  email: text('email').primaryKey(),
  role: text('role').notNull().default('editor'),
  createdAt: text('created_at').notNull(),
  invitedBy: text('invited_by').notNull(),
});

export const bookCovers = sqliteTable('book_covers', {
  key: text('key').primaryKey(),
  contentType: text('content_type').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
  createdAt: text('created_at').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
});
