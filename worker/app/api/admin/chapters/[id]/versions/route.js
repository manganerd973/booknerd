import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../lib/runtime.js';

export async function GET(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const db = await ensureDb();
    const [versions, audit] = await Promise.all([
      db.prepare(
        `SELECT id, title, workflow_status, scheduled_at, saved_by, created_at
         FROM chapter_versions
         WHERE chapter_id = ?
         ORDER BY created_at DESC
         LIMIT 60`
      ).bind(id).all(),
      db.prepare(
        `SELECT id, action, from_status, to_status, editor_email, created_at
         FROM chapter_audit
         WHERE chapter_id = ?
         ORDER BY created_at DESC
         LIMIT 120`
      ).bind(id).all(),
    ]);
    return Response.json({
      versions: (versions.results || []).map((row) => ({
        id: row.id,
        title: row.title,
        workflowStatus: row.workflow_status,
        scheduledAt: row.scheduled_at || null,
        savedBy: row.saved_by || '',
        createdAt: row.created_at,
      })),
      audit: (audit.results || []).map((row) => ({
        id: row.id,
        action: row.action,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        editorEmail: row.editor_email,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть историю главы.' }, { status: 500 });
  }
}
