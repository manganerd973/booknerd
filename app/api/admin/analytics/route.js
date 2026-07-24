import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

export async function GET(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const db = await ensureDb();
    const activeSince = new Date(Date.now() - 90 * 1000).toISOString();
    const [online, installs, notificationSubscribers, telegram, libraryTotals, libraryByBook, retentionByChapter, notificationReturns, waitingByBook] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS count FROM reader_presence WHERE updated_at >= ?`).bind(activeSince).first(),
      db.prepare(`SELECT COUNT(*) AS count FROM site_installs`).first(),
      db.prepare(`SELECT COUNT(DISTINCT visitor_key) AS count FROM push_subscriptions`).first(),
      db.prepare(`SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor_key) AS visitors FROM analytics_events WHERE event_type = 'telegram_click'`).first(),
      db.prepare(
        `SELECT
           COUNT(*) AS entries,
           COUNT(DISTINCT visitor_key) AS readers,
           SUM(CASE WHEN status = 'saved' THEN 1 ELSE 0 END) AS saved,
           SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) AS reading,
           SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS finished
         FROM reader_library`
      ).first(),
      db.prepare(
        `SELECT
           b.id,
           b.title,
           b.author,
           COUNT(rl.visitor_key) AS total,
           SUM(CASE WHEN rl.status = 'saved' THEN 1 ELSE 0 END) AS saved,
           SUM(CASE WHEN rl.status = 'reading' THEN 1 ELSE 0 END) AS reading,
           SUM(CASE WHEN rl.status = 'finished' THEN 1 ELSE 0 END) AS finished
         FROM books b
         LEFT JOIN reader_library rl ON rl.book_id = b.id
         WHERE b.published = 1
         GROUP BY b.id, b.title, b.author
         ORDER BY total DESC, reading DESC, b.title COLLATE NOCASE ASC`
      ).all(),
      db.prepare(
        `SELECT
           b.id AS book_id,
           b.title AS book_title,
           c.id AS chapter_id,
           c.chapter_number,
           c.title AS chapter_title,
           COUNT(DISTINCT rs.visitor_key) AS started,
           COUNT(DISTINCT CASE WHEN rs.completed = 1 OR rs.max_progress >= 95 THEN rs.visitor_key END) AS completed
         FROM reading_sessions rs
         JOIN chapters c ON c.id = rs.chapter_id
         JOIN books b ON b.id = rs.book_id
         GROUP BY b.id, b.title, c.id, c.chapter_number, c.title
         ORDER BY started DESC, completed ASC
         LIMIT 100`
      ).all(),
      db.prepare(
        `SELECT COUNT(DISTINCT visitor_key) AS readers, COUNT(*) AS sessions
         FROM reading_sessions WHERE notification_return = 1`
      ).first(),
      db.prepare(
        `SELECT book_key, COUNT(DISTINCT visitor_key) AS readers
         FROM notification_preferences
         WHERE new_chapter = 1
         GROUP BY book_key
         ORDER BY readers DESC`
      ).all(),
    ]);
    return Response.json({
      onlineReaders: Number(online?.count || 0),
      installs: Number(installs?.count || 0),
      notificationSubscribers: Number(notificationSubscribers?.count || 0),
      telegramVisitors: Number(telegram?.visitors || 0),
      telegramClicks: Number(telegram?.clicks || 0),
      library: {
        readers: Number(libraryTotals?.readers || 0),
        entries: Number(libraryTotals?.entries || 0),
        saved: Number(libraryTotals?.saved || 0),
        reading: Number(libraryTotals?.reading || 0),
        finished: Number(libraryTotals?.finished || 0),
        books: (libraryByBook.results || []).map((book) => ({
          id: book.id,
          title: book.title,
          author: book.author,
          total: Number(book.total || 0),
          saved: Number(book.saved || 0),
          reading: Number(book.reading || 0),
          finished: Number(book.finished || 0),
        })),
      },
      retention: {
        notificationReturnReaders: Number(notificationReturns?.readers || 0),
        notificationReturnSessions: Number(notificationReturns?.sessions || 0),
        chapters: (retentionByChapter.results || []).map((row) => {
          const started = Number(row.started || 0);
          const completed = Number(row.completed || 0);
          return {
            bookId: row.book_id,
            bookTitle: row.book_title,
            chapterId: row.chapter_id,
            chapterNumber: Number(row.chapter_number || 0),
            chapterTitle: row.chapter_title,
            started,
            completed,
            stopped: Math.max(0, started - completed),
            completionRate: started ? Math.round((completed / started) * 100) : 0,
          };
        }),
        waiting: (waitingByBook.results || []).map((row) => ({
          bookKey: row.book_key,
          readers: Number(row.readers || 0),
        })),
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Статистика временно недоступна.' }, { status: 503 });
  }
}
