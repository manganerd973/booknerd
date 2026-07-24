import { authorizeAdminRequest } from '../../../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../../../lib/runtime.js';

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id, versionId } = await params;
    const db = await ensureDb();
    const [current, version] = await Promise.all([
      db.prepare(`SELECT * FROM chapters WHERE id = ? LIMIT 1`).bind(id).first(),
      db.prepare(`SELECT * FROM chapter_versions WHERE id = ? AND chapter_id = ? LIMIT 1`).bind(versionId, id).first(),
    ]);
    if (!current || !version) return Response.json({ error: 'Версия главы не найдена.' }, { status: 404 });
    const now = new Date().toISOString();
    const editor = auth.email || auth.displayName || '';
    await db.batch([
      db.prepare(
        `INSERT INTO chapter_versions
         (id, chapter_id, title, point_of_view, body, body_rich, footnotes, team_note, workflow_status, scheduled_at, saved_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), id, current.title, current.point_of_view || '', current.body || '', current.body_rich || '',
        current.footnotes || '[]', current.team_note || '', current.workflow_status || 'draft',
        current.scheduled_at || null, editor, now,
      ),
      db.prepare(
        `UPDATE chapters
         SET title = ?, point_of_view = ?, body = ?, body_rich = ?, footnotes = ?, team_note = ?,
             status = ?, workflow_status = ?, scheduled_at = ?, last_edited_by = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        version.title, version.point_of_view || '', version.body || '', version.body_rich || '',
        version.footnotes || '[]', version.team_note || '',
        version.workflow_status === 'published' ? 'published' : 'draft',
        version.workflow_status || 'draft', version.scheduled_at || null, editor, now, id,
      ),
      db.prepare(
        `INSERT INTO chapter_audit (id, chapter_id, action, from_status, to_status, editor_email, created_at)
         VALUES (?, ?, 'restored', ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), id, current.workflow_status || 'draft', version.workflow_status || 'draft', editor, now,
      ),
    ]);
    return Response.json({ ok: true, id });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось восстановить версию.' }, { status: 500 });
  }
}
