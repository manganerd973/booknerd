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
  country: text('country').notNull().default(''),
  publicationYear: integer('publication_year'),
  pageCount: integer('page_count').notNull().default(0),
  plannedChapterCount: integer('planned_chapter_count').notNull().default(0),
  authorBirthday: text('author_birthday').notNull().default(''),
  originalReleaseDate: text('original_release_date').notNull().default(''),
  translator: text('translator').notNull().default(''),
  editor: text('editor').notNull().default(''),
  proofreader: text('proofreader').notNull().default(''),
  playlistUrl: text('playlist_url').notNull().default(''),
  teamPick: integer('team_pick', { mode: 'boolean' }).notNull().default(false),
  quoteOfDay: text('quote_of_day').notNull().default(''),
  searchAliases: text('search_aliases').notNull().default('[]'),
  dedication: text('dedication').notNull().default(''),
  triggerWarnings: text('trigger_warnings').notNull().default('[]'),
  suitabilityProfile: text('suitability_profile').notNull().default('{}'),
  ageRating: text('age_rating').notNull().default(''),
  ageReason: text('age_reason').notNull().default(''),
  hasHotScenes: integer('has_hot_scenes', { mode: 'boolean' }).notNull().default(false),
  hotSceneChapters: text('hot_scene_chapters').notNull().default(''),
  synopsis: text('synopsis').notNull().default(''),
  genres: text('genres').notNull().default('[]'),
  tropes: text('tropes').notNull().default('[]'),
  driveUrl: text('drive_url').notNull().default(''),
  status: text('status').notNull().default('Анонс'),
  progress: integer('progress').notNull().default(0),
  coverKey: text('cover_key'),
  worldMapKey: text('world_map_key'),
  worldMapName: text('world_map_name').notNull().default(''),
  worldMapContentType: text('world_map_content_type').notNull().default(''),
  worldMapSizeBytes: integer('world_map_size_bytes').notNull().default(0),
  worldMapMarkers: text('world_map_markers').notNull().default('[]'),
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
  index('chapters_workflow_scheduled_idx').on(table.workflowStatus, table.scheduledAt),
]);

export const chapterMusic = sqliteTable('chapter_music', {
  chapterId: text('chapter_id').primaryKey().references(() => chapters.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  fileName: text('file_name').notNull(),
  title: text('title').notNull().default(''),
  artist: text('artist').notNull().default(''),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  uploadedAt: text('uploaded_at').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
}, (table) => [
  uniqueIndex('chapter_music_storage_key_unique').on(table.storageKey),
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
  context: text('context').notNull().default('comments'),
  parentId: text('parent_id'),
  visitorKey: text('visitor_key').notNull().default(''),
  authorRole: text('author_role').notNull().default('reader'),
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
  index('book_reviews_voter_status_created_idx').on(table.voterKey, table.status, table.createdAt),
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
  index('reader_library_book_status_idx').on(table.bookId, table.status, table.visitorKey),
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
  commentReply: integer('comment_reply', { mode: 'boolean' }).notNull().default(true),
  teamNews: integer('team_news', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.bookKey] }),
  index('notification_preferences_book_idx').on(table.bookKey, table.newChapter),
]);

export const readerNotifications = sqliteTable('reader_notifications', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  eventKey: text('event_key').notNull(),
  type: text('type').notNull(),
  bookId: text('book_id').references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }),
  commentId: text('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  actorName: text('actor_name').notNull().default(''),
  title: text('title').notNull(),
  body: text('body').notNull(),
  url: text('url').notNull(),
  readAt: text('read_at'),
  hiddenAt: text('hidden_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('reader_notifications_visitor_event_unique').on(table.visitorKey, table.eventKey),
  index('reader_notifications_visitor_created_idx').on(table.visitorKey, table.createdAt),
  index('reader_notifications_visitor_read_idx').on(table.visitorKey, table.readAt, table.createdAt),
  index('reader_notifications_visitor_unread_idx').on(table.visitorKey, table.readAt, table.hiddenAt),
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
  index('reader_error_reports_visitor_status_updated_idx').on(table.visitorKey, table.status, table.updatedAt),
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

export const readerPublicNotes = sqliteTable('reader_public_notes', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  sourceAnnotationId: text('source_annotation_id').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull().default('Читатель BOOKNERD'),
  quote: text('quote').notNull(),
  note: text('note').notNull().default(''),
  paragraphIndex: integer('paragraph_index').notNull().default(0),
  page: integer('page').notNull().default(0),
  isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('pending'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  approvedAt: text('approved_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('reader_public_notes_source_unique').on(table.visitorKey, table.sourceAnnotationId),
  index('reader_public_notes_status_created_idx').on(table.status, table.createdAt),
  index('reader_public_notes_pinned_updated_idx').on(table.isPinned, table.updatedAt),
  index('reader_public_notes_book_chapter_idx').on(table.bookId, table.chapterId),
  index('reader_public_notes_rotation_idx').on(table.status, table.isSpoiler, table.isPinned, table.approvedAt, table.id),
  index('reader_public_notes_visitor_status_created_idx').on(table.visitorKey, table.status, table.createdAt),
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
  index('reading_sessions_visitor_completed_chapter_idx').on(table.visitorKey, table.completed, table.chapterId, table.bookId),
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

export const readerProfiles = sqliteTable('reader_profiles', {
  visitorKey: text('visitor_key').primaryKey(),
  displayName: text('display_name').notNull().default('Читатель BOOKNERD'),
  photoKey: text('photo_key'),
  photoName: text('photo_name').notNull().default(''),
  photoContentType: text('photo_content_type').notNull().default(''),
  photoSizeBytes: integer('photo_size_bytes').notNull().default(0),
  banner: text('banner').notNull().default('books'),
  favoriteCharacters: text('favorite_characters').notNull().default('[]'),
  favoriteQuotes: text('favorite_quotes').notNull().default('[]'),
  appTheme: text('app_theme').notNull().default('original'),
  atmosphere: text('atmosphere').notNull().default('auto'),
  mascotPreferences: text('mascot_preferences').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const readerLevelStats = sqliteTable('reader_level_stats', {
  visitorKey: text('visitor_key').primaryKey(),
  publicId: text('public_id').notNull(),
  totalXp: integer('total_xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  rankKey: text('rank_key').notNull().default('newcomer'),
  completedChapters: integer('completed_chapters').notNull().default(0),
  completedBooks: integer('completed_books').notNull().default(0),
  completedSeries: integer('completed_series').notNull().default(0),
  approvedReviews: integer('approved_reviews').notNull().default(0),
  confirmedErrors: integer('confirmed_errors').notNull().default(0),
  savedQuotes: integer('saved_quotes').notNull().default(0),
  uniqueReadingDays: integer('unique_reading_days').notNull().default(0),
  completedBookKeys: text('completed_book_keys').notNull().default('[]'),
  completedSeriesKeys: text('completed_series_keys').notNull().default('[]'),
  publicVisible: integer('public_visible', { mode: 'boolean' }).notNull().default(true),
  onlineVisible: integer('online_visible', { mode: 'boolean' }).notNull().default(true),
  currentBookVisible: integer('current_book_visible', { mode: 'boolean' }).notNull().default(true),
  plannedShelfVisible: integer('planned_shelf_visible', { mode: 'boolean' }).notNull().default(true),
  favoriteShelfVisible: integer('favorite_shelf_visible', { mode: 'boolean' }).notNull().default(true),
  achievementsVisible: integer('achievements_visible', { mode: 'boolean' }).notNull().default(true),
  ratingStatus: text('rating_status').notNull().default('active'),
  suspiciousReason: text('suspicious_reason').notNull().default(''),
  firstCountedAt: text('first_counted_at'),
  lastCountedAt: text('last_counted_at'),
  recalculatedAt: text('recalculated_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('reader_level_stats_public_id_unique').on(table.publicId),
  index('reader_level_stats_public_rank_idx').on(table.publicVisible, table.ratingStatus, table.totalXp),
]);

export const readerMonthlyStats = sqliteTable('reader_monthly_stats', {
  visitorKey: text('visitor_key').notNull(),
  monthKey: text('month_key').notNull(),
  xp: integer('xp').notNull().default(0),
  completedChapters: integer('completed_chapters').notNull().default(0),
  completedBooks: integer('completed_books').notNull().default(0),
  completedSeries: integer('completed_series').notNull().default(0),
  approvedReviews: integer('approved_reviews').notNull().default(0),
  confirmedErrors: integer('confirmed_errors').notNull().default(0),
  uniqueReadingDays: integer('unique_reading_days').notNull().default(0),
  genreCount: integer('genre_count').notNull().default(0),
  quotesSaved: integer('quotes_saved').notNull().default(0),
  levelGrowth: integer('level_growth').notNull().default(0),
  reachedXpAt: text('reached_xp_at'),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.monthKey] }),
  index('reader_monthly_stats_ranking_idx').on(table.monthKey, table.xp, table.completedBooks, table.uniqueReadingDays, table.completedChapters),
]);

export const readerAchievements = sqliteTable('reader_achievements', {
  visitorKey: text('visitor_key').notNull(),
  achievementKey: text('achievement_key').notNull(),
  unlockedAt: text('unlocked_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.achievementKey] }),
  index('reader_achievements_unlocked_idx').on(table.visitorKey, table.unlockedAt),
]);

export const readerMonthlyAwards = sqliteTable('reader_monthly_awards', {
  visitorKey: text('visitor_key').notNull(),
  monthKey: text('month_key').notNull(),
  nominationKey: text('nomination_key').notNull(),
  title: text('title').notNull(),
  awardedAt: text('awarded_at').notNull(),
  awardedBy: text('awarded_by').notNull().default('system'),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.monthKey, table.nominationKey] }),
  index('reader_monthly_awards_reader_idx').on(table.visitorKey, table.awardedAt),
]);

export const readerLevelConfig = sqliteTable('reader_level_config', {
  id: text('id').primaryKey(),
  config: text('config').notNull().default('{}'),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull().default(''),
});

export const readerXpAdjustments = sqliteTable('reader_xp_adjustments', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  delta: integer('delta').notNull(),
  oldXp: integer('old_xp').notNull(),
  newXp: integer('new_xp').notNull(),
  reason: text('reason').notNull(),
  changedBy: text('changed_by').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('reader_xp_adjustments_reader_created_idx').on(table.visitorKey, table.createdAt),
]);

export const readerMonthFinalizations = sqliteTable('reader_month_finalizations', {
  monthKey: text('month_key').primaryKey(),
  status: text('status').notNull().default('started'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

export const mascotSettings = sqliteTable('mascot_settings', {
  id: text('id').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  aiEnabled: integer('ai_enabled', { mode: 'boolean' }).notNull().default(false),
  disabledPages: text('disabled_pages').notNull().default('[]'),
  blockedTopics: text('blocked_topics').notNull().default('[]'),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull().default(''),
});

export const mascotDialogues = sqliteTable('mascot_dialogues', {
  id: text('id').primaryKey(),
  category: text('category').notNull().default('tip'),
  pages: text('pages').notNull().default('[]'),
  lines: text('lines').notNull().default('[]'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  startsAt: text('starts_at'),
  endsAt: text('ends_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull().default(''),
}, (table) => [
  index('mascot_dialogues_active_dates_idx').on(table.active, table.startsAt, table.endsAt),
]);

export const paragraphReactions = sqliteTable('paragraph_reactions', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  paragraphIndex: integer('paragraph_index').notNull().default(0),
  emoji: text('emoji').notNull(),
  selectedText: text('selected_text').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('paragraph_reactions_reader_unique').on(table.visitorKey, table.chapterId, table.paragraphIndex, table.emoji),
  index('paragraph_reactions_chapter_idx').on(table.chapterId, table.paragraphIndex),
]);

export const readerDictionary = sqliteTable('reader_dictionary', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  word: text('word').notNull(),
  meaning: text('meaning').notNull().default(''),
  quote: text('quote').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('reader_dictionary_visitor_book_idx').on(table.visitorKey, table.bookId, table.createdAt),
]);

export const chapterEmotions = sqliteTable('chapter_emotions', {
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.chapterId] }),
  index('chapter_emotions_book_idx').on(table.bookId, table.chapterId),
]);

export const readerTimeCapsules = sqliteTable('reader_time_capsules', {
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  firstImpression: text('first_impression').notNull().default(''),
  finalImpression: text('final_impression').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.visitorKey, table.bookId] }),
]);

export const communityPosts = sqliteTable('community_posts', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  bookId: text('book_id').references(() => books.id, { onDelete: 'set null' }),
  kind: text('kind').notNull().default('theory'),
  authorName: text('author_name').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('approved'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('community_posts_kind_created_idx').on(table.kind, table.createdAt),
  index('community_posts_book_created_idx').on(table.bookId, table.createdAt),
]);

export const communityVotes = sqliteTable('community_votes', {
  postId: text('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
  visitorKey: text('visitor_key').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.postId, table.visitorKey] }),
]);
