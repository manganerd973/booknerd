import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

const TABLES = ['books','chapters','book_artworks','comments','comment_votes','comment_reports','book_ratings','book_reviews','reader_library','reader_bookmarks','reader_error_reports','book_glossary','chapter_versions','chapter_audit','reading_sessions','paragraph_reactions','reader_public_notes','chapter_emotions','reader_time_capsules','community_posts','community_votes'];

export async function GET(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const db = await ensureDb();
    const data = {};
    for (const table of TABLES) {
      const result = await db.prepare(`SELECT * FROM ${table}`).all();
      data[table] = result.results || [];
    }
    return new Response(JSON.stringify({ format: 'BOOKNERD_BACKUP_V27', createdAt: new Date().toISOString(), createdBy: auth.email || '', data }), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="booknerd-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' } });
  } catch (error) { return Response.json({ error: error.message || 'Не удалось создать резервную копию.' }, { status: 500 }); }
}
