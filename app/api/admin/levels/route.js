import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { invalidateCachedRead } from '../../../../lib/read-cache.js';
import { ensureDb } from '../../../../lib/runtime.js';
import { DEFAULT_READER_LEVEL_CONFIG, sanitizeReaderLevelConfig, xpForLevel } from '../../../../lib/reader-level-config.js';
import { finalizeReaderMonth, monthKey, normalizeReaderKey, readReaderLevelConfig, refreshReaderLevel } from '../../../../lib/reader-levels.js';

function cleanText(value, max = 300) { return String(value || '').trim().slice(0, max); }

async function preview(db) {
  const [readers, existing, achievements] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM (SELECT visitor_key FROM reader_profiles UNION SELECT visitor_key FROM reading_sessions UNION SELECT voter_key AS visitor_key FROM book_reviews UNION SELECT visitor_key FROM reader_error_reports UNION SELECT visitor_key FROM reader_library)`).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM reader_level_stats`).first(),
    db.prepare(`SELECT COUNT(*) AS total FROM reader_achievements`).first(),
  ]);
  const total = Number(readers?.total || 0);
  const missing = Math.max(0, total - Number(existing?.total || 0));
  const estimatedRows = missing * 3 + Math.max(0, total * 4 - Number(achievements?.total || 0));
  return { readers: total, existingReaders: Number(existing?.total || 0), estimatedNewRows: estimatedRows, estimatedBytes: estimatedRows * 260, note: 'Оценка включает итоговую, месячную и несколько компактных записей достижений. Книги и главы не копируются.' };
}

export async function GET(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const db = await ensureDb();
    const q = cleanText(new URL(request.url).searchParams.get('q'), 80);
    const [config, top, flagged, estimate, errors, adjustments] = await Promise.all([
      readReaderLevelConfig(db),
      db.prepare(`SELECT s.visitor_key, s.public_id, s.total_xp, s.level, s.rank_key, s.rating_status, s.public_visible, s.suspicious_reason, p.display_name FROM reader_level_stats s LEFT JOIN reader_profiles p ON p.visitor_key = s.visitor_key WHERE (? = '' OR p.display_name LIKE '%' || ? || '%' OR s.public_id LIKE '%' || ? || '%') ORDER BY s.total_xp DESC LIMIT 100`).bind(q, q, q).all(),
      db.prepare(`SELECT s.public_id, s.total_xp, s.level, s.suspicious_reason, p.display_name FROM reader_level_stats s LEFT JOIN reader_profiles p ON p.visitor_key = s.visitor_key WHERE s.rating_status = 'review' ORDER BY s.updated_at DESC LIMIT 100`).all(),
      preview(db),
      db.prepare(`SELECT COUNT(*) AS total FROM reader_month_finalizations WHERE status != 'completed'`).first(),
      db.prepare(`SELECT x.old_xp, x.new_xp, x.delta, x.reason, x.changed_by, x.created_at, s.public_id, p.display_name FROM reader_xp_adjustments x JOIN reader_level_stats s ON s.visitor_key = x.visitor_key LEFT JOIN reader_profiles p ON p.visitor_key = x.visitor_key ORDER BY x.created_at DESC LIMIT 50`).all(),
    ]);
    return Response.json({ config, readers: top.results || [], flagged: flagged.results || [], preview: estimate, systemErrors: Number(errors?.total || 0), adjustments: adjustments.results || [] });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть уровни и рейтинг.' }, { status: 500 });
  }
}

export async function PUT(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const config = sanitizeReaderLevelConfig((await request.json()).config || DEFAULT_READER_LEVEL_CONFIG);
    const db = await ensureDb();
    await db.prepare(`INSERT INTO reader_level_config (id, config, updated_at, updated_by) VALUES ('global', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .bind(JSON.stringify(config), new Date().toISOString(), auth.email || 'owner').run();
    invalidateCachedRead('reader-level-config:v48');
    return Response.json({ ok: true, config });
  } catch (error) { return Response.json({ error: error.message || 'Не удалось сохранить настройки.' }, { status: 500 }); }
}

export async function POST(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const payload = await request.json();
    const action = cleanText(payload.action, 40);
    const db = await ensureDb();
    if (action === 'preview-backfill') return Response.json({ ok: true, preview: await preview(db) });
    if (action === 'backfill') {
      const cursor = cleanText(payload.cursor, 120);
      const batchSize = Math.max(1, Math.min(25, Number(payload.batchSize || 25)));
      const result = await db.prepare(`SELECT visitor_key FROM (SELECT visitor_key FROM reader_profiles UNION SELECT visitor_key FROM reading_sessions UNION SELECT voter_key AS visitor_key FROM book_reviews UNION SELECT visitor_key FROM reader_error_reports UNION SELECT visitor_key FROM reader_library) WHERE visitor_key > ? ORDER BY visitor_key LIMIT ?`).bind(cursor, batchSize).all();
      const rows = result.results || [];
      for (const row of rows) await refreshReaderLevel({ db, visitorKey: row.visitor_key, legacyBackfill: true, suppressNotifications: true });
      return Response.json({ ok: true, processed: rows.length, nextCursor: rows.length === batchSize ? rows.at(-1).visitor_key : null });
    }
    const publicId = cleanText(payload.publicId, 30);
    const reader = publicId ? await db.prepare(`SELECT * FROM reader_level_stats WHERE public_id = ? LIMIT 1`).bind(publicId).first() : null;
    if (!reader && !['finalize-month'].includes(action)) return Response.json({ error: 'Читатель не найден.' }, { status: 404 });
    if (action === 'recalculate') {
      const summary = await refreshReaderLevel({ db, visitorKey: reader.visitor_key, legacyBackfill: true, suppressNotifications: true });
      return Response.json({ ok: true, summary });
    }
    if (action === 'adjust-xp') {
      const requestedDelta = Math.max(-1000000, Math.min(1000000, Math.round(Number(payload.delta || 0))));
      const reason = cleanText(payload.reason, 300);
      if (!requestedDelta || reason.length < 4) return Response.json({ error: 'Укажите изменение XP и причину.' }, { status: 400 });
      const floor = xpForLevel(Number(reader.level || 1), (await readReaderLevelConfig(db)).levelCurve);
      const newXp = Math.max(floor, Number(reader.total_xp || 0) + requestedDelta);
      const delta = newXp - Number(reader.total_xp || 0);
      await db.prepare(`INSERT INTO reader_xp_adjustments (id, visitor_key, delta, old_xp, new_xp, reason, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), reader.visitor_key, delta, Number(reader.total_xp || 0), newXp, reason, auth.email || 'owner', new Date().toISOString()).run();
      const summary = await refreshReaderLevel({ db, visitorKey: reader.visitor_key, suppressNotifications: true });
      return Response.json({ ok: true, summary });
    }
    if (action === 'group-read') {
      const eventKey = cleanText(payload.eventKey, 80).replace(/[^a-zA-Z0-9:_-]/g, '-');
      if (!eventKey) return Response.json({ error: 'Укажите код совместного чтения.' }, { status: 400 });
      const config = await readReaderLevelConfig(db);
      const delta = Number(config.xp.groupRead || 0);
      const result = await db.prepare(`INSERT OR IGNORE INTO reader_xp_adjustments (id, visitor_key, delta, old_xp, new_xp, reason, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(`group:${eventKey}:${reader.visitor_key}`, reader.visitor_key, delta, Number(reader.total_xp || 0), Number(reader.total_xp || 0) + delta, `Официальное совместное чтение: ${eventKey}`, auth.email || 'owner', new Date().toISOString()).run();
      if (Number(result.meta?.changes || 0) > 0) await refreshReaderLevel({ db, visitorKey: reader.visitor_key, suppressNotifications: true });
      return Response.json({ ok: true, alreadyGranted: Number(result.meta?.changes || 0) === 0 });
    }
    if (action === 'rating-status') {
      const status = ['active', 'review', 'hidden'].includes(payload.status) ? payload.status : 'active';
      await db.prepare(`UPDATE reader_level_stats SET rating_status = ?, suspicious_reason = CASE WHEN ? = 'active' THEN '' ELSE suspicious_reason END, updated_at = ? WHERE visitor_key = ?`).bind(status, status, new Date().toISOString(), reader.visitor_key).run();
      return Response.json({ ok: true });
    }
    if (action === 'public-visible') {
      await db.prepare(`UPDATE reader_level_stats SET public_visible = ?, updated_at = ? WHERE visitor_key = ?`).bind(payload.visible === false ? 0 : 1, new Date().toISOString(), reader.visitor_key).run();
      return Response.json({ ok: true });
    }
    if (action === 'award') {
      const nominationKey = cleanText(payload.nominationKey, 60);
      const title = cleanText(payload.title, 80);
      if (!nominationKey || !title) return Response.json({ error: 'Укажите награду.' }, { status: 400 });
      await db.prepare(`INSERT OR REPLACE INTO reader_monthly_awards (visitor_key, month_key, nomination_key, title, awarded_at, awarded_by) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(reader.visitor_key, monthKey(), nominationKey, title, new Date().toISOString(), auth.email || 'owner').run();
      return Response.json({ ok: true });
    }
    if (action === 'remove-award') {
      await db.prepare(`DELETE FROM reader_monthly_awards WHERE visitor_key = ? AND month_key = ? AND nomination_key = ?`).bind(reader.visitor_key, cleanText(payload.monthKey, 7), cleanText(payload.nominationKey, 60)).run();
      return Response.json({ ok: true });
    }
    if (action === 'finalize-month') return Response.json(await finalizeReaderMonth(db, cleanText(payload.monthKey, 7) || undefined));
    return Response.json({ error: 'Неизвестное действие.' }, { status: 400 });
  } catch (error) { return Response.json({ error: error.message || 'Не удалось выполнить действие.' }, { status: 500 }); }
}
