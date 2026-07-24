import { blob, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  originalTitle: text('original_title').notNull().default(''),
  seriesTitle: text('series_title').notNull().default(''),
  seriesNumber: integer('series_number'),
  seriesReadingOrder: text('series_reading_order').notNull().default('[]'),
  releaseDays: text('release_days').notNull().default('[]'),
  author: text('author').notNull(),
  dedication: text('dedication').notNull().default(''),
  triggerWarnings: text('trigger_warnings').notNull().default('[]'),
  hasHotScenes: integer('has_hot_scenes', { mode: 'boolean' }).notNull().default(false),
  hotSceneChapters: text('hot_scene_chapters').notNull().default(''),
  synopsis: text('synopsis').notNull().default(''),
  genres: text('genres').notNull().default('[]'),
  tropes: text('tropes').notNull().default('[]'),
  driveUrl: text('drive_url').notNull().default(''),
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
  pointOfView: text('point_of_view').notNull().default(''),
  body: text('body').notNull().default(''),
  bodyRich: text('body_rich').notNull().default(''),
  footnotes: text('footnotes').notNull().default('[]'),
  heatLevel: integer('heat_level').notNull().default(0),
  heatPages: text('heat_pages').notNull().default(''),
  teamNote: text('team_note').notNull().default(''),
  driveUrl: text('drive_url').notNull().default(''),
  status: text('status').notNull().default('draft'),
  workflowStatus: text('workflow_status').notNull().default('draft'),
  scheduledAt: text('scheduled_at'),
  lastEditedBy: text('last_edited_by').notNull().default(''),
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

export const bookArtworks = sqliteTable('book_artworks', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  imageKey: text('image_key').notNull(),
  caption: text('caption').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  visitorKey: text('visitor_key').notNull().default(''),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('approved'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const commentVotes = sqliteTable('comment_votes', {
  commentId: text('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  voterKey: text('voter_key').notNull(),
  value: integer('value').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.commentId, table.voterKey] }),
]);

export const commentReports = sqliteTable('comment_reports', {
  commentId: text('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  voterKey: text('voter_key').notNull(),
  reason: text('reason').notNull(),
  details: text('details').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.commentId, table.voterKey] }),
]);

export const bookRatings = sqliteTable('book_ratings', {
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  voterKey: text('voter_key').notNull(),
  rating: integer('rating').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.bookId, table.voterKey] }),
]);

export const bookReviews = sqliteTable('book_reviews', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  voterKey: text('voter_key').notNull(),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  rating: integer('rating').notNull(),
  status: text('status').notNull().default('approved'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('book_reviews_book_voter_unique').on(table.bookId, table.voterKey),
]);

export const readerPresence = sqliteTable('reader_presence', {
  visitorKey: text('visitor_key').primaryKey(),
  bookId: text('book_id').notNull().default(''),
  chapterId: text('chapter_id').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('reader_presence_updated_idx').on(table.updatedAt),
]);

export const siteInstalls = sqliteTable('site_installs', {
  visitorKey: text('visitor_key').primaryKey(),
  platform: text('platform').notNull().default('unknown'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
});

export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  visitorKey: text('visitor_key').notNull(),
  path: text('path').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('analytics_events_type_created_idx').on(table.eventType, table.createdAt),
  index('analytics_events_type_visitor_idx').on(table.eventType, table.visitorKey),
]);

export const readerLibrary = sqliteTable('reader_library', {
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('saved'),
  lastChapterId: text('last_chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  lastPage: integer('last_page').notNull().default(0),
  progress: integer('progress').notNull().default(0),
  readingSeconds: integer('reading_seconds').notNull().default(0),
  lastOpenedAt: text('last_opened_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.bookId] }),
  index('reader_library_visitor_updated_idx').on(table.visitorKey, table.updatedAt),
]);

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('push_subscriptions_visitor_idx').on(table.visitorKey),
]);

export const vapidConfig = sqliteTable('vapid_config', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: text('created_at').notNull(),
});

export const pushAnnouncements = sqliteTable('push_announcements', {
  chapterId: text('chapter_id').primaryKey().references(() => chapters.id, { onDelete: 'cascade' }),
  sentAt: text('sent_at').notNull(),
});

export const notificationPreferences = sqliteTable('notification_preferences', {
  visitorKey: text('visitor_key').notNull(),
  bookKey: text('book_key').notNull(),
  newChapter: integer('new_chapter', { mode: 'boolean' }).notNull().default(true),
  translationComplete: integer('translation_complete', { mode: 'boolean' }).notNull().default(false),
  authorBook: integer('author_book', { mode: 'boolean' }).notNull().default(false),
  commentReply: integer('comment_reply', { mode: 'boolean' }).notNull().default(false),
  teamNews: integer('team_news', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.bookKey] }),
  index('notification_preferences_book_idx').on(table.bookKey, table.newChapter),
]);

export const readerErrorReports = sqliteTable('reader_error_reports', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  selectedText: text('selected_text').notNull(),
  paragraphIndex: integer('paragraph_index').notNull().default(0),
  page: integer('page').notNull().default(0),
  details: text('details').notNull().default(''),
  status: text('status').notNull().default('new'),
  resolvedBy: text('resolved_by').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('reader_error_reports_status_created_idx').on(table.status, table.createdAt),
  index('reader_error_reports_chapter_idx').on(table.chapterId, table.paragraphIndex),
]);

export const bookGlossary = sqliteTable('book_glossary', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  category: text('category').notNull().default('character'),
  name: text('name').notNull(),
  pronunciation: text('pronunciation').notNull().default(''),
  description: text('description').notNull().default(''),
  connections: text('connections').notNull().default(''),
  revealAfterChapter: integer('reveal_after_chapter').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('book_glossary_book_reveal_idx').on(table.bookId, table.revealAfterChapter, table.sortOrder),
]);

export const readerBookmarks = sqliteTable('reader_bookmarks', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  category: text('category').notNull().default('later'),
  quote: text('quote').notNull().default(''),
  paragraphIndex: integer('paragraph_index').notNull().default(0),
  page: integer('page').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('reader_bookmarks_visitor_book_idx').on(table.visitorKey, table.bookId, table.createdAt),
]);

export const chapterVersions = sqliteTable('chapter_versions', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  pointOfView: text('point_of_view').notNull().default(''),
  body: text('body').notNull().default(''),
  bodyRich: text('body_rich').notNull().default(''),
  footnotes: text('footnotes').notNull().default('[]'),
  teamNote: text('team_note').notNull().default(''),
  workflowStatus: text('workflow_status').notNull().default('draft'),
  scheduledAt: text('scheduled_at'),
  savedBy: text('saved_by').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('chapter_versions_chapter_created_idx').on(table.chapterId, table.createdAt),
]);

export const chapterAudit = sqliteTable('chapter_audit', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  fromStatus: text('from_status').notNull().default(''),
  toStatus: text('to_status').notNull().default(''),
  editorEmail: text('editor_email').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('chapter_audit_chapter_created_idx').on(table.chapterId, table.createdAt),
]);

export const readingSessions = sqliteTable('reading_sessions', {
  visitorKey: text('visitor_key').notNull(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  readingDate: text('reading_date').notNull(),
  seconds: integer('seconds').notNull().default(0),
  maxProgress: integer('max_progress').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  notificationReturn: integer('notification_return', { mode: 'boolean' }).notNull().default(false),
  startedAt: text('started_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.chapterId, table.readingDate] }),
  index('reading_sessions_book_chapter_idx').on(table.bookId, table.chapterId),
  index('reading_sessions_visitor_date_idx').on(table.visitorKey, table.readingDate),
]);

export const translationCandidates = sqliteTable('translation_candidates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull().default(''),
  suggestedBy: text('suggested_by').notNull().default(''),
  status: text('status').notNull().default('suggested'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const translationVotes = sqliteTable('translation_votes', {
  candidateId: text('candidate_id').notNull().references(() => translationCandidates.id, { onDelete: 'cascade' }),
  visitorKey: text('visitor_key').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.candidateId, table.visitorKey] }),
]);
